export function initSymmetricButtons(){
 document.addEventListener('click',event=>{
  if(event.detail>0)event.target.closest?.('.symmetric-part')?.blur();
 });
}
