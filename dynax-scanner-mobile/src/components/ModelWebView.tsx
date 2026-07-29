import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { theme } from '@/theme';

// Renders an OBJ mesh with Three.js inside a WebView. Self-contained: only
// three.min.js is loaded from a CDN; the OBJ is parsed inline and the mesh
// auto-rotates with touch-drag to orbit. Works in Expo Go on iOS + Android.
export function ModelWebView({ objText }: { objText: string }) {
  const safe = objText.replace(/<\/script>/gi, '<\\/script>');
  const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>html,body{margin:0;height:100%;background:#0f172a;overflow:hidden;touch-action:none}</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
</head><body>
<script id="model" type="text/plain">${safe}</script>
<script>
(function(){
  function parseOBJ(text){
    var positions=[], verts=[];
    var lines=text.split('\\n');
    for(var i=0;i<lines.length;i++){
      var p=lines[i].trim().split(/\\s+/);
      if(p[0]==='v'){ verts.push([+p[1],+p[2],+p[3]]); }
      else if(p[0]==='f'){
        var idx=[];
        for(var k=1;k<p.length;k++){ idx.push(parseInt(p[k].split('/')[0],10)-1); }
        for(var t=1;t<idx.length-1;t++){
          [0,t,t+1].forEach(function(c){ var v=verts[idx[c]]; if(v){positions.push(v[0],v[1],v[2]);} });
        }
      }
    }
    return new Float32Array(positions);
  }
  try{
    var text=document.getElementById('model').textContent;
    var pos=parseOBJ(text);
    var scene=new THREE.Scene();
    var geo=new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    geo.computeVertexNormals(); geo.center();
    geo.computeBoundingSphere();
    var r=(geo.boundingSphere&&geo.boundingSphere.radius)||1;
    var mat=new THREE.MeshStandardMaterial({color:0xcbd5e1,roughness:0.85,metalness:0.05,flatShading:true});
    var mesh=new THREE.Mesh(geo,mat); scene.add(mesh);
    var cam=new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.01, 1000);
    cam.position.set(0,0,r*2.6);
    var rnd=new THREE.WebGLRenderer({antialias:true}); rnd.setPixelRatio(window.devicePixelRatio);
    rnd.setSize(window.innerWidth, window.innerHeight); rnd.setClearColor(0x0f172a,1);
    document.body.appendChild(rnd.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff,0x334155,1.1));
    var key=new THREE.DirectionalLight(0xffffff,0.8); key.position.set(1,1,1); scene.add(key);
    var rx=0, ry=0, autox=0, dragging=false, lx=0, ly=0;
    var el=rnd.domElement;
    el.addEventListener('touchstart',function(e){dragging=true;lx=e.touches[0].clientX;ly=e.touches[0].clientY;});
    el.addEventListener('touchmove',function(e){ if(!dragging)return; var t=e.touches[0]; ry+=(t.clientX-lx)*0.01; rx+=(t.clientY-ly)*0.01; lx=t.clientX; ly=t.clientY; e.preventDefault();},{passive:false});
    el.addEventListener('touchend',function(){dragging=false;});
    function loop(){ requestAnimationFrame(loop); if(!dragging) autox+=0.004; mesh.rotation.y=ry+autox; mesh.rotation.x=rx; rnd.render(scene,cam); }
    loop();
    window.addEventListener('resize',function(){ cam.aspect=window.innerWidth/window.innerHeight; cam.updateProjectionMatrix(); rnd.setSize(window.innerWidth,window.innerHeight); });
  }catch(err){ document.body.innerHTML='<div style="color:#94a3b8;font-family:sans-serif;padding:24px;text-align:center">Preview unavailable</div>'; }
})();
</script>
</body></html>`;

  return (
    <View style={styles.wrap}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.web}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        androidLayerType="hardware"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, borderRadius: theme.radius.lg, overflow: 'hidden', backgroundColor: theme.color.bgTop },
  web: { flex: 1, backgroundColor: theme.color.bgTop },
});
