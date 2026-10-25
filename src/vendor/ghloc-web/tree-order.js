// Adapted from useLocs.tsx in pajecawav/ghloc-web, efb19a82421543b34775940837d73d90b231ce95.
// Copyright (c) 2025 pajecawav. MIT; see LICENSE.
export function treeOrder(a,b){
 const folderA=a.type==='tree',folderB=b.type==='tree';
 if(folderA!==folderB)return Number(folderB)-Number(folderA);
 return a.path===b.path?0:a.path<b.path?-1:1;
}
