declare module 'bwip-js' {
  export function toBuffer(opts: Record<string, unknown>): Promise<Buffer>;
  const bwipjs: { toBuffer: typeof toBuffer };
  export default bwipjs;
}
