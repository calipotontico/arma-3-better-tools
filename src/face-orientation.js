import * as THREE from 'three';

export function createFaceOrientation(){
  const material=new THREE.ShaderMaterial({
    side:THREE.DoubleSide,
    vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`void main(){
      gl_FragColor=gl_FrontFacing?vec4(0.035,0.22,1.0,1.0):vec4(1.0,0.025,0.035,1.0);
      #include <colorspace_fragment>
    }`
  });
  // Swap only during rendering: saving, exporting and history always see real materials.
  return {render(root,draw){
    const saved=[];
    try{
      root?.traverse(mesh=>{
        if(!mesh.isMesh)return;
        saved.push([mesh,mesh.material]);
        const override=m=>m?.visible===false?m:material;
        mesh.material=Array.isArray(mesh.material)?mesh.material.map(override):override(mesh.material);
      });
      draw();
    }finally{for(const [mesh,original] of saved)mesh.material=original;}
  },dispose:()=>material.dispose()};
}

export function installFaceOrientation(){
  const panel=document.createElement('section');
  panel.innerHTML=`<label><input id="faceOrientation" type="checkbox"> Ver orientación de caras</label><p class="hint">Azul: lado frontal. Rojo: reverso. Gira la cámara para comprobar ambos lados. Rojo no significa siempre un error: depende de desde dónde mires. En modo Caras, selecciona las incorrectas y pulsa «Invertir caras seleccionadas». Esta vista no cambia las texturas ni se exporta.</p>`;
  document.getElementById('subobjectPanel').after(panel);
  const view=createFaceOrientation(),toggle=panel.querySelector('input');
  return {render(root,draw){if(toggle.checked)view.render(root,draw);else draw();}};
}
