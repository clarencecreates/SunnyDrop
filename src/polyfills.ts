// Safari shipped with macOS 14 may lack this API used by PDF.js.
if(!Promise.withResolvers){Object.defineProperty(Promise,'withResolvers',{value:function<T>(){let resolve!:(value:T|PromiseLike<T>)=>void;let reject!:(reason?:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};},configurable:true,writable:true});}
if(typeof ReadableStream!=='undefined'&&!(Symbol.asyncIterator in ReadableStream.prototype)){
  Object.defineProperty(ReadableStream.prototype,Symbol.asyncIterator,{value:async function*(this:ReadableStream<unknown>){const reader=this.getReader();try{while(true){const item=await reader.read();if(item.done)return;yield item.value;}}finally{reader.releaseLock();}},configurable:true,writable:true});
}
