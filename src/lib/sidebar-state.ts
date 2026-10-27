export const sidebarDefinitions={
 repository:{panel:'.repo-tree',toggle:'.tree-toggle',storage:'tree-collapsed',attribute:'data-tree-collapsed',openLabel:'展开目录',closeLabel:'收起目录'},
 files:{panel:'.github-files',toggle:'.github-files-toggle',storage:'github-files-collapsed',attribute:'data-files-collapsed',openLabel:'展开文件列表',closeLabel:'收起文件列表'}
};
const preferences=Object.values(sidebarDefinitions).map(({storage,attribute})=>({storage,attribute}));
export const sidebarBootstrap=`for(const s of ${JSON.stringify(preferences)})try{document.documentElement.setAttribute(s.attribute,String(localStorage.getItem(s.storage)==='true'))}catch{}`;
