const form=document.getElementById('legalSearch');
const queryInput=document.getElementById('legalQuery');
const statusNode=document.getElementById('legalStatus');
const resultsNode=document.getElementById('legalResults');
const ALLOWED=[
 /^https?:\/\/creativecommons\.org\/publicdomain\/(?:zero|mark)\/1\.0\/?$/i,
 /^https?:\/\/creativecommons\.org\/licenses\/(?:by|by-sa)\/(?:[234]\.0|1\.0)\/?$/i
];
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function acceptedLicense(value){const list=Array.isArray(value)?value:[value];return list.map(v=>String(v||'').trim()).find(url=>ALLOWED.some(rule=>rule.test(url)))||'';}
function setStatus(message){statusNode.textContent=message;}
function torrentFile(files,identifier){return files.find(f=>typeof f.name==='string'&&f.name.toLowerCase()===String(identifier+'_archive.torrent').toLowerCase())||files.find(f=>typeof f.name==='string'&&f.name.toLowerCase().endsWith('.torrent'));}
function render(items){
 resultsNode.innerHTML=items.map(item=>`<article class="legal-card"><h3>${esc(item.title)}</h3><div class="legal-meta">${esc(item.year||'Year not listed')} · Internet Archive</div><span class="legal-license">${esc(item.licenseLabel)}</span><div class="legal-actions"><a class="primary-button" href="${esc(item.torrentUrl)}" target="_blank" rel="noopener noreferrer">Download .torrent ↗</a><a class="secondary-button" href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">View source & licence</a></div></article>`).join('');
}
async function search(title){
 resultsNode.replaceChildren();setStatus('Searching Internet Archive and checking licences…');
 try{
  const params=new URLSearchParams({q:'title:"'+title.replace(/["\\]/g,' ')+'" AND mediatype:movies',rows:'30',page:'1',output:'json'});
  ['identifier','title','year'].forEach(field=>params.append('fl[]',field));
  const response=await fetch('https://archive.org/advancedsearch.php?'+params.toString());
  if(!response.ok)throw new Error('The public catalogue is temporarily unavailable.');
  const payload=await response.json();
  const docs=Array.isArray(payload.response?.docs)?payload.response.docs:[];
  if(!docs.length){setStatus('No catalogue matches found. Try another title.');return;}
  const found=[];
  for(const item of docs.slice(0,18)){
   if(!item.identifier)continue;
   try{
    const metaResponse=await fetch('https://archive.org/metadata/'+encodeURIComponent(item.identifier));
    if(!metaResponse.ok)continue;
    const record=await metaResponse.json();const metadata=record.metadata||{};
    const licence=acceptedLicense(metadata.licenseurl);if(!licence)continue;
    const file=torrentFile(Array.isArray(record.files)?record.files:[],item.identifier);if(!file)continue;
    found.push({title:metadata.title||item.title||title,year:metadata.year||item.year||'',license:licence,licenseLabel:licence.includes('publicdomain')?'Public Domain':'Creative Commons BY / BY-SA',torrentUrl:'https://archive.org/download/'+encodeURIComponent(item.identifier)+'/'+encodeURIComponent(file.name),sourceUrl:'https://archive.org/details/'+encodeURIComponent(item.identifier)});
    if(found.length>=12)break;
   }catch(_){/* Ignore individual records that cannot be checked. */}
  }
  if(!found.length){setStatus('No matching records with an accepted licence and torrent file were found.');return;}
  render(found);setStatus(found.length+' legal-catalogue match'+(found.length===1?'':'es')+' found. Review each source licence before reuse.');
 }catch(error){setStatus(error.message||'Search failed. Please try again later.');}
}
form.addEventListener('submit',event=>{event.preventDefault();const title=queryInput.value.trim();if(title.length<2){setStatus('Enter at least two characters.');return;}search(title);});
