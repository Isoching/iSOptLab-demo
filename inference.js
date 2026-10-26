/* Portable point prediction from frozen model parameters; no fitting or remote calls. */
function sum(values) {
  let total=0, correction=0;
  for(const value of values){const y=value-correction,t=total+y;correction=(t-total)-y;total=t;}
  return total;
}
function kernel(k,x,y){
  switch(k.type){
    case 'Sum':return kernel(k.a,x,y)+kernel(k.b,x,y);
    case 'Product':return kernel(k.a,x,y)*kernel(k.b,x,y);
    case 'ConstantKernel':return k.value;
    case 'WhiteKernel':return 0; // Cross-covariance to the saved training basis.
    case 'RBF':return Math.exp(-.5*sum(x.map((v,i)=>((v-y[i])/k.length[k.length.length===1?0:i])**2)));
    default:throw new Error('Unsupported saved kernel: '+k.type);
  }
}
function response(model,x){
  const z=x.map((v,i)=>(v-model.centre[i])/model.scale[i]);
  if(model.kind==='polynomial')return sum(model.powers.map((p,i)=>model.coefficients[i]*p.reduce((value,power,j)=>value*z[j]**power,1)));
  if(model.kind==='gpr'){
    const value=sum(model.X.map((row,i)=>kernel(model.kernel,z,row)*model.alpha[i]));
    return model.yMean+model.yScale*(model.gpMean+model.gpScale*value);
  }
  if(model.kind==='mlp'){
    const values=model.members.map(member=>{
      let current=z;
      member.weights.forEach((weights,layer)=>{
        const next=member.biases[layer].map((bias,j)=>bias+sum(current.map((v,i)=>v*weights[i][j])));
        current=layer===member.weights.length-1?next:next.map(Math.tanh);
      });
      return current[0];
    });
    return model.yMean+model.yScale*sum(values)/values.length;
  }
  throw new Error('Unsupported saved model: '+model.kind);
}
export function predictModel(model,x){
  if(x.length!==2||x.some(v=>!Number.isFinite(v)))throw new Error('Supply two finite inputs.');
  const result=Object.fromEntries(Object.entries(model.responses).map(([name,fit])=>[name,response(fit,x)]));
  if(Object.values(result).some(v=>!Number.isFinite(v)))throw new Error('Prediction is not finite.');
  return result;
}
export function withinTrainingBounds(model,x){return x.every((v,i)=>v>=model.trainingBounds[0][i]&&v<=model.trainingBounds[1][i]);}
