import { resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * The three Supabase clients carry the generated `Database` type, so the compiler checks table
 * names, column names and the job enums. This compiles small snippets against the real clients
 * and asserts which ones the compiler refuses: a typo in `pipeline_state`, `route` or
 * `delivery_profile` must fail the build, not reach production as a 400.
 */

const ROOT = resolve(import.meta.dirname, '..')

function compile(body: string): string[] {
  const file = resolve(ROOT, 'tests', '__typed_client_fixture__.ts')
  const source = `
import { supabaseAdmin } from '@/lib/supabase-admin'
import { supabaseBrowser } from '@/lib/supabase-client'
import { supabaseServer } from '@/lib/supabase-server'
import type { PipelineState } from '@/lib/jobs/states'
void supabaseBrowser; void supabaseServer
export async function fixture() {
  const admin = supabaseAdmin()
  const browser = supabaseBrowser()
  const server = await supabaseServer()
  void admin; void browser; void server
  ${body}
}
`
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2017,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    esModuleInterop: true,
    jsx: ts.JsxEmit.ReactJSX,
    lib: ['lib.dom.d.ts', 'lib.esnext.d.ts'],
    baseUrl: ROOT,
    paths: { '@/*': ['./*'] },
    types: ['node'],
  }
  const host = ts.createCompilerHost(options)
  const read = host.readFile.bind(host)
  const exists = host.fileExists.bind(host)
  host.readFile = (f) => (resolve(f) === file ? source : read(f))
  host.fileExists = (f) => resolve(f) === file || exists(f)
  const program = ts.createProgram([file], options, host)
  return ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.file && resolve(d.file.fileName) === file)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
}

describe('typed Supabase clients', { timeout: 120_000 }, () => {
  it('accept real tables, columns and enum values', () => {
    expect(
      compile(`
        const { data } = await admin.from('song_jobs').select('id, pipeline_state, route, delivery_profile').limit(1)
        const s: PipelineState | null | undefined = data?.[0]?.pipeline_state
        void s
        await admin.from('song_jobs').update({ pipeline_state: 'queued' }).eq('id', 'x')
        await admin.from('song_jobs').insert({
          id: 'x', user_id: 'u', title: 't', primary_artist: 'a', source_language: 'en',
          target_language: 'es', status: 'approved', route: 'door1', delivery_profile: 'door1',
          pipeline_state: 'queued',
        })
        await browser.from('song_jobs').select('id, status').limit(1)
        await server.from('song_jobs').select('id, status').limit(1)
      `),
    ).toEqual([])
  })

  it('refuse a pipeline_state typo on update', () => {
    expect(compile(`await admin.from('song_jobs').update({ pipeline_state: 'queud' }).eq('id', 'x')`)).not.toEqual([])
  })

  it('refuse a route or delivery_profile typo on insert', () => {
    const insert = (extra: string) => `
      await admin.from('song_jobs').insert({
        id: 'x', user_id: 'u', title: 't', primary_artist: 'a', source_language: 'en',
        target_language: 'es', status: 'approved', ${extra},
      })`
    expect(compile(insert(`route: 'door2'`))).not.toEqual([])
    expect(compile(insert(`delivery_profile: 'door3'`))).not.toEqual([])
  })

  it('refuse an unknown table or column on every client', () => {
    expect(compile(`await admin.from('song_jobz').select('id')`)).not.toEqual([])
    expect(compile(`const { data } = await server.from('song_jobs').select('titel'); void data?.[0]?.titel.length`)).not.toEqual([])
    expect(compile(`await browser.from('song_jobs').update({ nope: 1 }).eq('id', 'x')`)).not.toEqual([])
  })
})
