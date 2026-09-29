import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// Satu aplikasi: SPA ini dilayani Laravel langsung dari `public/`, jadi tidak
// ada laravel-vite-plugin. Hasil build masuk ke public/build, dan di dev
// server Vite mem-proxy permintaan backend ke `php artisan serve`.
//
// Env dibaca dari .env milik Laravel (satu file untuk backend + frontend).
// Aman: Vite hanya membocorkan variabel berawalan VITE_ ke kode klien.
export default defineConfig(({ command, isPreview, mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const backend = env.VITE_DEV_BACKEND || 'http://localhost:8000'

    /**
     * SPA disajikan Laravel, tapi `php artisan serve` memakai public/index.php
     * sebagai router script, sehingga rute non-API yang bukan berkas nyata
     * (deep-link seperti /app/projects) harus diserahkan ke shell SPA.
     * Plugin ini menambahkan middleware dev Vite yang meniru perilaku itu,
     * supaya `npm run dev` dan produksi tidak menyimpang.
     */
    const spaFallback = {
        name: 'spa-fallback',
        configureServer(server: { middlewares: { use: (fn: (req: any, _res: unknown, next: () => void) => void) => void } }) {
            server.middlewares.use((req, _res, next) => {
                const path = (req.url ?? '/').split('?')[0]
                const isApi = path === '/api' || path.startsWith('/api/')
                const isAsset = path.startsWith('/build/') || path.startsWith('/storage/') || path === '/up'
                const hasExtension = /\.[a-zA-Z0-9]+$/.test(path)

                if (isApi || isAsset || hasExtension) return next()

                req.url = '/'
                next()
            })
        },
    }

    return {
        plugins: [react(), tailwindcss(), spaFallback],

        // Di dev server, sumber daya langsung dari root. Saat build/preview,
        // SPA disajikan Laravel dari public/, jadi aset ditulis dengan prefix
        // /build/ agar cocok dengan lokasi hasil build.
        base: command === 'build' || isPreview ? '/build/' : '/',

        build: {
            outDir: 'public/build',
            emptyOutDir: true,
        },

        // Aset statis (favicon, robots) sudah tinggal di public/ milik Laravel,
        // jadi Vite tidak perlu menyalin apa pun dan tidak boleh menyentuhnya.
        publicDir: false,

        server: {
            // Same-origin supaya token Sanctum dan cookie sesi tidak kena CORS.
            proxy: {
                '/api': { target: backend, changeOrigin: true },
                '/auth': { target: backend, changeOrigin: true },
                '/storage': { target: backend, changeOrigin: true },
                '/up': { target: backend, changeOrigin: true },
            },
        },
        preview: {
            port: 4173,
            // `vite preview` melayani hasil build apa adanya, jadi /api dan
            // /auth harus tetap di-proxy ke backend — sama seperti dev.
            proxy: {
                '/api': { target: backend, changeOrigin: true },
                '/auth': { target: backend, changeOrigin: true },
                '/storage': { target: backend, changeOrigin: true },
                '/up': { target: backend, changeOrigin: true },
            },
        },
    }
})
