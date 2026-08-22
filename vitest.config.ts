import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // 단위 테스트에서는 서버 전용 가드를 무력화한다 (아래 stub 파일의 주석 참조)
      'server-only': path.resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
})
