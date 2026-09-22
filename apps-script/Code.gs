const CONFIG={SHEET_NAME:"",HEADER_ROW:1};

function doGet(){
  try{
    const s=getSheet_(),v=s.getDataRange().getValues();
    if(!v.length)return out_({success:true,data:[]});
    const h=v[CONFIG.HEADER_ROW-1].map(norm_),rows=v.slice(CONFIG.HEADER_ROW).filter(r=>r.some(x=>String(x??"").trim()!==""));
    return out_({success:true,data:normalize_(h,rows)});
  }catch(e){console.error(e);return out_({success:false,error:"Unable to read Google Sheet"});}
}
function doPost(e){
 try{
  const p=JSON.parse(e.postData.contents||"{}"),req=["date","billNo","salesman","particulars","itemDetails","unit"];
  req.forEach(k=>{if(!val_(p[k]))throw Error("Missing required field: "+k)});
  const qty=Number(p.qty),price=Number(p.price);if(!isFinite(qty)||qty<=0)throw Error("Qty must be greater than zero.");if(!isFinite(price)||price<0)throw Error("Price must be zero or greater.");
  const s=getSheet_(),map=headerMap_(s),row=new Array(s.getLastColumn()).fill("");
  put_(row,map,["date"],p.date);put_(row,map,["billno"],p.billNo);put_(row,map,["salesman"],p.salesman);put_(row,map,["particulars","customer"],p.particulars);
  put_(row,map,["itemdetails","itemdetail"],p.itemDetails);put_(row,map,["alias"],p.alias||"");put_(row,map,["materialcentre","materialcenter"],p.materialCentre||"");
  put_(row,map,["qty","quantity"],qty);put_(row,map,["unit"],p.unit);put_(row,map,["price"],price);put_(row,map,["amount"],qty*price);
  s.appendRow(row);return out_({success:true,message:"Entry added successfully",amount:qty*price});
 }catch(e){console.error(e);return out_({success:false,error:e.message||"Unable to add entry"});}
}
function getSheet_(){const ss=SpreadsheetApp.getActiveSpreadsheet();if(!ss)throw Error("No spreadsheet");if(CONFIG.SHEET_NAME){const s=ss.getSheetByName(CONFIG.SHEET_NAME);if(!s)throw Error("Sheet not found");return s}return ss.getSheets()[0]}
function normalize_(h,rows){let c={date:"",billNo:"",salesman:"",particulars:"",materialCentre:""};return rows.map(r=>{let x={};h.forEach((k,i)=>x[k]=r[i]);if(val_(x.date))c.date=fmt_(x.date);if(val_(x.billno))c.billNo=String(x.billno);if(val_(x.salesman))c.salesman=String(x.salesman);if(val_(x.particulars||x.customer))c.particulars=String(x.particulars||x.customer);if(val_(x.materialcentre||x.materialcenter))c.materialCentre=String(x.materialcentre||x.materialcenter);return{date:c.date,billNo:c.billNo,salesman:c.salesman,particulars:c.particulars,itemDetails:str_(x.itemdetails||x.itemdetail),alias:str_(x.alias),materialCentre:c.materialCentre,qty:num_(x.qty||x.quantity),unit:str_(x.unit),price:num_(x.price),amount:num_(x.amount)}})}
function headerMap_(s){let h=s.getRange(CONFIG.HEADER_ROW,1,1,s.getLastColumn()).getValues()[0].map(norm_),m={};h.forEach((x,i)=>{if(x)m[x]=i+1});return m}
function put_(r,m,n,v){for(const k of n)if(m[k]){r[m[k]-1]=v;return}throw Error("Missing Sheet column: "+n[0])}
function norm_(x){return String(x??"").toLowerCase().trim().replace(/[\/_\-().]/g,"").replace(/\s+/g,"")}
function val_(x){return x!==null&&x!==undefined&&String(x).trim()!==""}
function str_(x){return x==null?"":String(x)}
function num_(x){const n=Number(String(x??"").replace(/,/g,""));return isFinite(n)?n:0}
function fmt_(x){return Object.prototype.toString.call(x)==="[object Date]"&&!isNaN(x)?Utilities.formatDate(x,Session.getScriptTimeZone(),"dd-MM-yyyy"):String(x??"")}
function out_(x){return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON)}






AKfycbw1M5DyohSY0l2AgrXKKX8JdVGUdVIa2EabOTIf1uTkDBeo6qjxbb2LBLlgD6-IxhMg

URl https://script.google.com/macros/s/AKfycbw1M5DyohSY0l2AgrXKKX8JdVGUdVIa2EabOTIf1uTkDBeo6qjxbb2LBLlgD6-IxhMg/exec

