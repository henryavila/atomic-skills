/// <reference types="vite/client" />

// Side-effect imports of CSS files (e.g. `import './styles/index.css'`).
declare module '*.css' {
  const css: string
  export default css
}
