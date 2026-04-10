<template>
  <div ref="container" class="w-screen h-screen bg-slate-900"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
// 引入自带的影棚环境光，这是玻璃质感的灵魂！
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
// 🌟 引入并实例化风洞数据引擎
import { useWindTunnelStore } from '../store/windTunnel'
const wtStore = useWindTunnelStore()

const container = ref(null)
let scene, camera, renderer, controls
let animationId

let teslaModel = null
let smokeParticles = null

// 记录粒子的初始状态，用于流体力学计算
const particleData =[]

// 🌟 统一定义烟雾的起点和终点 🌟
// 改这两个数字，就能完美控制烟雾的生成和消失位置！
const SMOKE_START_X = 0.4  // 右侧发烟管口 X 坐标
const SMOKE_END_X = -0.7   // 左侧排风口 X 坐标

const initThree = () => {
  // 1. 基础场景设置
  scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x0b0f19, 0.02) // 深色科技背景

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.set(0.08, 1, 3.18) // 调整一个绝佳的初始观察视角

  // 2. 渲染器高级设置 (抗锯齿、物理光照)
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.toneMapping = THREE.ACESFilmicToneMapping // 电影级色调映射
  renderer.toneMappingExposure = 1.2                 // 曝光度
  container.value.appendChild(renderer.domElement)

  // 🌟 核心魔法：生成逼真的环境反射 🌟
  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture
  
  // 【压暗全局环境光】，让场景彻底暗下来，准备迎接彩色霓虹光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.1) 
  scene.add(ambientLight)

  // 4. 控制器
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  //controls.autoRotate = true      // 开启缓慢自动旋转，非常适合大屏展示
  controls.autoRotateSpeed = 0.5

  // 5. 加载模型
  const loader = new GLTFLoader()
  const modelPath = `${import.meta.env.BASE_URL}models/wind_tunnel.glb`

  loader.load(modelPath, (gltf) => {
    const model = gltf.scene

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true

        // 🌟 智能名称匹配引擎 🌟
        // 同时检查 网格名、父级名、材质名，确保 100% 命中你的 Blender 分类
        const meshName = child.name.toLowerCase()
        const parentName = child.parent ? child.parent.name.toLowerCase() : ''
        const matName = child.material ? child.material.name.toLowerCase() : ''
        
        const isMatch = (keyword) => 
          meshName.includes(keyword) || parentName.includes(keyword) || matName.includes(keyword)


        // ==========================================
        // 1. 全息亚克力外壳 (Acrylic_Shell)
        // ==========================================
        if (isMatch('acrylic')) {
          child.material = new THREE.MeshPhysicalMaterial({
            color: 0x88ddff,       
            metalness: 0.8,        
            roughness: 0.0,        
            transparent: true,     
            opacity: 0.15,         
            transmission: 0.0,     
            envMapIntensity: 5.0,  
            clearcoat: 1.0,        
            clearcoatRoughness: 0.0,
            side: THREE.DoubleSide,
            depthWrite: false      
          })

          // 发光描边骨架
          const edges = new THREE.EdgesGeometry(child.geometry)
          const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x00e5ff,
            transparent: true,
            opacity: 0.3,
            depthWrite: false
          })
          const wireframe = new THREE.LineSegments(edges, lineMaterial)
          child.add(wireframe)
        } 
        
        // ==========================================
        // 2. 顶部灯带发光管 (Glass_Light)
        // ==========================================
        else if (isMatch('glass_light') || isMatch('glasslight')) {
          child.material = new THREE.MeshPhysicalMaterial({
            color: 0x001122,       // 【关键】底色调为极深的蓝色或黑色，让蓝光更纯粹
            emissive: 0x0088ff,    // 【关键】明亮的科技蓝
            emissiveIntensity: 20, // 【关键】暴力提升强度，让它产生“过曝”的视觉感
            roughness: 0.0,
            metalness: 0.0,
            transmission: 0.0,     // 关闭透射，发光管不需要透明，否则会显得虚
            transparent: false,    
            side: THREE.FrontSide
          })
          
          // 给灯带手动加一盏微型点光源（可选，增加对内部零件的照射感）
          //const lightTint = new THREE.PointLight(0x0088ff, 1, 2)
          //child.add(lightTint)
        }
        
        // ==========================================
        // 3. 传感器 (ABS_Sensor) - 纯白微磨砂塑料
        // ==========================================
        else if (isMatch('abs_sensor') || isMatch('abs')) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0x4b5563,       // 【修改】标准的工业深灰色（接近灰黑色）
            roughness: 2,        // 增加粗糙度，显得更像哑光工程塑料
            metalness: 0.2,        
            envMapIntensity: 0.1   // 降低环境反光，让灰色更稳重
          })
        }
        
        // ==========================================
        // 4. 底部轨道 (Alu_Rails) - 抛光铝合金
        // ==========================================
        else if (isMatch('alu_rails') || isMatch('aluminum') || isMatch('alu')) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0x94a3b8,       // 亮银色
            roughness: 0.25,       // 稍微有一点拉丝感
            metalness: 0.85,       // 强金属反射
            envMapIntensity: 1.5
          })
        }
        
        // ==========================================
        // 5. 零配件 (Steel_Acc) - 抛光不锈钢
        // ==========================================
        else if (isMatch('steel_acc') || isMatch('steel')) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0x334155,       // 比铝更暗、更深邃的钢灰色
            roughness: 0.15,       // 非常光滑
            metalness: 0.95,       // 极强金属感（接近镜面）
            envMapIntensity: 2.0
          })
        }
        
        // ==========================================
        // 6. 烟雾发射管 (CarbonFiber_SmokeTube) - 碳纤维亮光涂层
        // ==========================================
        else if (isMatch('carbon') || isMatch('smoke')) {
          child.material = new THREE.MeshPhysicalMaterial({
            color: 0x0f172a,       // 极深的碳黑色
            roughness: 0.6,        // 碳纤维内层较粗糙
            metalness: 0.5,        
            clearcoat: 1.0,        // 💎 核心：表面覆盖一层透明反光的树脂清漆
            clearcoatRoughness: 0.1,
            envMapIntensity: 1.5
          })
        }
        
        // ==========================================
        // 7. 兜底材质 (防漏网之鱼)
        // ==========================================
        else {
          if (child.material) {
            child.material.color.setHex(0x1e293b) // 统一染成暗夜灰
            child.material.roughness = 0.5
            child.material.metalness = 0.5
          }
        }
      }
    })

    // ==========================================
    // 终极居中与缩放算法
    // ==========================================
    const tunnelScale = 2.5 // 根据你的屏幕微调这个倍数
    model.scale.set(tunnelScale, tunnelScale, tunnelScale)
    
    // 【关键】：强制 Three.js 根据新的缩放比例计算世界坐标
    model.updateMatrixWorld(true) 

    // 计算缩放后的包围盒与中心点
    const box = new THREE.Box3().setFromObject(model)
    const center = box.getCenter(new THREE.Vector3())

    // 反向平移，将几何中心绝对锁定在 0,0,0
    model.position.x -= center.x
    model.position.y -= center.y
    model.position.z -= center.z
    
    // Y轴稍微抬高一点给底座留空间
    model.position.y += 0.2
    scene.add(model)
  })

  // ==========================================
  // 加载特斯拉测试车
  // ==========================================
  loader.load(`${import.meta.env.BASE_URL}models/tesla.glb`, (gltf) => {
    teslaModel = gltf.scene

    // 给车漆换上科技感液态银/深空灰
    teslaModel.traverse((child) => {
      if (child.isMesh && child.material) {
        if (child.material.name.toLowerCase().includes('paint') || child.name.toLowerCase().includes('body')) {
          child.material = new THREE.MeshPhysicalMaterial({
            color: 0x222222,
            metalness: 0.8,
            roughness: 0.1,
            clearcoat: 1.0,
            clearcoatRoughness: 0.05
          })
        }
      }
    })

    // 缩放并放置在力学轨道上
    // 注意：这里的数值需要根据你的风洞比例微调
    const carScale = 0.025 
    teslaModel.scale.set(carScale, carScale, carScale) 
    teslaModel.position.set(-0.32, 0.015, 0.35) // X轴往左靠一点，Y轴放在轨道上
    // 如果车头反了，让它转 180 度或 90 度面向右边的排烟管
    teslaModel.rotation.y = -Math.PI/2

    scene.add(teslaModel)
    
    // 车加载完后，启动烟雾！
    createSmokeEffect()
  })

  // 增加一个极简的网格地面（增加空间纵深感）
  const gridHelper = new THREE.GridHelper(10, 20, 0x00e5ff, 0x00e5ff)
  gridHelper.material.opacity = 0.1
  gridHelper.material.transparent = true
  gridHelper.position.y = -0.5
  scene.add(gridHelper)

  animate()
}

// ==========================================
// 智能烟雾流线引擎 (CFD Simulation)
// ==========================================
// 🌟 顶部定义全局颜色基准 🌟
const baseColor = new THREE.Color(0x00e5ff) // 基础科技青蓝
const hotColor = new THREE.Color(0xff3300)  // 高能等离子橙红
const currentColor = new THREE.Color()      // 临时计算颜色

const createSmokeEffect = () => {
  const particleCount = 3000
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(particleCount * 3)
  const colors = new Float32Array(particleCount * 3) // 🌟 新增：颜色数组

  for (let i = 0; i < particleCount; i++) {
    const x = SMOKE_END_X + Math.random() * (SMOKE_START_X - SMOKE_END_X)
    const baseY = 0.19 + (Math.random() - 0.5) * 0.18 
    const baseZ = (Math.random() - 0.5) * 0.2         
    
    positions[i * 3] = x
    positions[i * 3 + 1] = baseY
    positions[i * 3 + 2] = baseZ

    // 初始颜色全部赋为基准色
    colors[i * 3] = baseColor.r
    colors[i * 3 + 1] = baseColor.g
    colors[i * 3 + 2] = baseColor.b

    particleData.push({
      speed: 0.02 + Math.random() * 0.015,
      baseY: baseY,
      baseZ: baseZ
    })
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)) // 🌟 绑定颜色数据

  const material = new THREE.PointsMaterial({
    size: 0.025,            
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending, 
    depthWrite: false,
    vertexColors: true // 🌟 核心开关：允许每个粒子拥有独立颜色！不再使用单一 color
  })

  smokeParticles = new THREE.Points(geometry, material)
  smokeParticles.frustumCulled = false 
  scene.add(smokeParticles)
}

const animate = () => {
  animationId = requestAnimationFrame(animate)
  controls.update()

  // ========================================================
  // 🌟 核心联动：从数据层获取实时风速 🌟
  // ========================================================
  // wtStore.actualSpeedMs 最高大概是 55m/s (200km/h)
  const currentWindSpeed = wtStore.actualSpeedMs
  
  // 计算动画速度倍率：风速为 0 时倍率为 0，最高风速时倍率约 5.5
  const speedMultiplier = currentWindSpeed / 10.0 

  if (smokeParticles && teslaModel) {
    // wtStore.actualSpeedMs 最高大概是 55m/s (200km/h)
    const currentWindSpeed = wtStore.actualSpeedMs
    const speedMultiplier = currentWindSpeed / 10.0 

    smokeParticles.material.opacity = Math.min(0.6, currentWindSpeed * 0.05)

    const positions = smokeParticles.geometry.attributes.position.array
    const colors = smokeParticles.geometry.attributes.color.array // 🌟 获取颜色数组
    const carX = teslaModel.position.x
    
    // 🌟 高能变色算法 1：根据当前总风速，计算全局“基础热量”
    // 当风速接近 50m/s 时，heatRatio 接近 1.0 (全红)；风速低时是 0 (全蓝)
    const heatRatio = Math.min(currentWindSpeed / 50.0, 1.0)
    currentColor.copy(baseColor).lerp(hotColor, heatRatio)

    for (let i = 0; i < particleData.length; i++) {
      const data = particleData[i]
      const idx = i * 3
      
      const actualMoveSpeed = data.speed * speedMultiplier
      
      if (actualMoveSpeed > 0) {
        positions[idx] -= actualMoveSpeed

        const currentX = positions[idx]
        let currentY = positions[idx + 1]
        let currentZ = positions[idx + 2]

        const distToCar = currentX - carX
        const bumpStart = 0.4
        const bumpEnd = -0.2
        const liftHeight = 0.08
        const spreadWidth = 0.1
        // 🌟 新增：缓冲区长度（气流在车后多少距离内完全恢复平稳）
        const tailLength = 1.0 

        if (distToCar < bumpStart) {
          if (distToCar > bumpEnd) {
            // 1. 车身正上方：维持你完美的正弦波
            const progress = (distToCar - bumpEnd) / (bumpStart - bumpEnd)
            const curve = Math.sin(progress * Math.PI)
            currentY = data.baseY + (curve * liftHeight)
            const spread = data.baseZ > 0 ? (curve * spreadWidth) : -(curve * spreadWidth)
            currentZ = data.baseZ + spread
          } 
          else if (distToCar <= bumpEnd && distToCar > (bumpEnd - tailLength)) {
            // 🌟 2. 核心修复：车后尾流区 🌟
            // 不再使用 += 0.1，而是根据离开车尾的距离计算一个衰减比例 (1 到 0)
            const tailProgress = (distToCar - (bumpEnd - tailLength)) / tailLength 
            // 使用幂函数让下坠更自然（从 1 快速降向 0）
            const decay = Math.pow(tailProgress, 2) 
            
            currentY = data.baseY + (liftHeight * 0 * decay) // 这里 0 是因为 sin 在 bumpEnd 处为 0
            // 如果你想让尾流有个自然的下沉过渡，可以微调这里
            // 我们让它从刚才在 bumpEnd 处的状态平滑过渡回 baseY
            currentY = data.baseY + (currentY - data.baseY) * decay
            currentZ = data.baseZ + (currentZ - data.baseZ) * decay
          }
          else {
            // 3. 彻底远离车身后：完全回归基准
            currentY = data.baseY
            currentZ = data.baseZ
          }
        } else {
          // 4. 还未接触到车头：保持基准
          currentY = data.baseY
          currentZ = data.baseZ
        }

        positions[idx + 1] = currentY
        positions[idx + 2] = currentZ

        // 🌟 高能变色算法 2：X轴物理衰减 (X-Axis Dissipation)
        // 粒子刚从右侧(SMOKE_START_X)喷出时最亮，吹到左侧(SMOKE_END_X)时逐渐冷却变暗
        // 计算当前粒子在管道中的进度 (0.0 ~ 1.0)
        const travelProgress = (SMOKE_START_X - currentX) / (SMOKE_START_X - SMOKE_END_X)
        
        // 亮度衰减系数：刚喷出时是 1.0，吹到尾部时降到 0.2
        const intensity = Math.max(1.0 - (travelProgress * 0.8), 0.2)

        // 将混合好的高能颜色，乘以衰减系数，赋给当前粒子
        colors[idx] = currentColor.r * intensity
        colors[idx + 1] = currentColor.g * intensity
        colors[idx + 2] = currentColor.b * intensity

        if (positions[idx] < SMOKE_END_X) {
          positions[idx] = SMOKE_START_X + Math.random() * 0.2
          positions[idx + 1] = data.baseY
          positions[idx + 2] = data.baseZ
        }
      }
    }
    
    smokeParticles.geometry.attributes.position.needsUpdate = true
    smokeParticles.geometry.attributes.color.needsUpdate = true // 🌟 通知显卡更新颜色
  }

  renderer.render(scene, camera)
}

const onWindowResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

onMounted(() => {
  initThree()
  window.addEventListener('resize', onWindowResize)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', onWindowResize)
  renderer.dispose()
})
</script>