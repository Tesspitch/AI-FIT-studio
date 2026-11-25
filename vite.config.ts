import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const wasmDirectory = new URL('./node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url)
const wasmFiles = [
  'vision_wasm_internal.js', 'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm',
]

export default defineConfig(({ command }) => ({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [react(), tailwindcss(), {
    name: 'mediapipe-runtime',
    configureServer(server) {
      server.middlewares.use('/mediapipe', async (request, response, next) => {
        const file = request.url?.slice(1).split('?')[0]
        if (!file || !wasmFiles.includes(file)) return next()
        try {
          const source = await readFile(new URL(file, wasmDirectory))
          response.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript')
          response.end(source)
        } catch (error) {
          next(error)
        }
      })
    },
    async buildStart() {
      if (command !== 'build') return
      for (const file of wasmFiles) {
        this.emitFile({ type: 'asset', fileName: `mediapipe/${file}`, source: await readFile(new URL(file, wasmDirectory)) })
      }
    },
  }],
}))
