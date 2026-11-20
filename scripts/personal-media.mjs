import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
export const mediaPattern = /^\/personal-media\/[a-f0-9]{64}\.webp$/;
export async function uploadPersonalImage({ data }, { root } = {}) {
 if (typeof data !== 'string' || !data.length || data.length > 14_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error('请选择不超过 10MB 的 JPEG、PNG 或 WebP 图片。');
 const bytes = Buffer.from(data,'base64');
 if(bytes.length>10*1024*1024 || bytes.toString('base64')!==data) throw new Error('图片内容无效或超过 10MB。');
 let output;
 try {
  const image=sharp(bytes,{limitInputPixels:40_000_000,animated:false});
  const meta=await image.metadata();
  if(!['jpeg','png','webp'].includes(meta.format) || (meta.pages||1)>1) throw Error();
  output=await image.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
 } catch { throw new Error('无法读取图片，请选择 JPEG、PNG 或 WebP 静态图片。'); }
 const filename=createHash('sha256').update(output).digest('hex')+'.webp';
 const folder=path.join(root,'public/personal-media');await mkdir(folder,{recursive:true});
 // shortcut: 已上传文件保留以免误删共用照片，空间不足时再按内容引用清理。
 try{await writeFile(path.join(folder,filename),output,{flag:'wx'})}catch(error){if(error.code!=='EEXIST')throw error}
 return {src:'/personal-media/'+filename};
}
