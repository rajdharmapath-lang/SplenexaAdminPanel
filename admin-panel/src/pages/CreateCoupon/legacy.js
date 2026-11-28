// Behaviour carried over unchanged from the original HTML page.
// Runs once after the JSX markup mounts; `document`, `window`, `parent` and timers are
// scoped shims provided by useLegacyScript (see src/legacy/useLegacyScript.js).
import { populateCoursePlanSelect } from '../../coursePlans';

export default function init(document, window, parent, setTimeout, setInterval) {
populateCoursePlanSelect(document.getElementById('coupon-products'), window);
const $=i=>document.getElementById(i);
document.querySelectorAll('#types .ty').forEach(t=>t.onclick=()=>{document.querySelectorAll('#types .ty').forEach(x=>x.classList.remove('on'));t.classList.add('on')});
const code=$('code'),name=$('nm'),discount=$('dv'),generate=$('gen');
if(code)code.oninput=e=>{if($('pc'))$('pc').textContent=e.target.value||'CODE'};
if(name)name.oninput=e=>{if($('pn'))$('pn').textContent=e.target.value};
if(discount)discount.oninput=e=>{if($('pv'))$('pv').textContent=e.target.value};
if(generate)generate.onclick=()=>{const c='FMGE'+Math.floor(10+Math.random()*80);if(code)code.value=c;if($('pc'))$('pc').textContent=c};
}
