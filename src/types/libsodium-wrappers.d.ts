declare module 'libsodium-wrappers/dist/modules/libsodium-wrappers.js' {
  import type sodium from 'libsodium-wrappers'
  const _sodium: typeof sodium
  export default _sodium
}
