import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// 讀取 package.json 的版本號
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// 建置時自動取得 git commit 短雜湊（本機開發或無 git 時顯示 dev）
const gitCommit = (() => {
    try {
        return execSync('git rev-parse --short HEAD').toString().trim()
    } catch {
        return 'dev'
    }
})()

// 建置時間（台北時區 UTC+8；手動計算避免各環境 Intl/locale 差異產生特殊字元）
const buildTime = new Date(Date.now() + 8 * 3600 * 1000)
    .toISOString().slice(0, 16).replace('T', ' ')

// 建置時輸出 version.json 到 dist 根目錄，供前端執行期檢查是否有新版本
const versionPlugin = () => ({
    name: 'emit-version-json',
    apply: 'build',
    generateBundle() {
        this.emitFile({
            type: 'asset',
            fileName: 'version.json',
            source: JSON.stringify({ version: pkg.version, commit: gitCommit, buildTime })
        })
    }
})

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), versionPlugin()],
    base: '/lotto-app/',
    define: {
        // 編譯期常數：直接嵌入程式碼，UI 可顯示目前執行中的版本
        __APP_VERSION__: JSON.stringify(pkg.version),
        __GIT_COMMIT__: JSON.stringify(gitCommit),
        __BUILD_TIME__: JSON.stringify(buildTime)
    }
})
