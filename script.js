let scene, camera, renderer, controls;
let flowerGroup, particleGroups = [];
let loadingElement, containerElement;
let isGenerating = false;
let generationComplete = false;
let clock = new THREE.Clock();
let particles = [];
let particleCount = 0;
let bloomComposer, finalComposer;
let animationProgress = 0;
let branchesGenerated = 0;
let totalBranchesToGenerate = 0;
let postProcessingEnabled = false;
let stemObject = null;
let allMeshes = [];

const STEM_COLOR = 0x2E7D32;
const BRANCH_COLOR = 0x558B2F;
const BRANCH_SECONDARY_COLOR = 0x689F38;
const BRANCH_TERTIARY_COLOR = 0x7CB342;
const FLOWER_COLOR = 0xFFD700;
const BACKGROUND_COLOR = 0x1A1A2E;
const PARTICLE_COLORS = [0xFFD700, 0xFFC125, 0xFFAA00, 0xFFE44D];

const STEM_HEIGHT = 12;
const STEM_RADIUS = 0.15;
const NUM_BRANCHES = 20;
const NUM_SECONDARY_BRANCHES = 3;
const NUM_TERTIARY_BRANCHES = 2;
const FLOWERS_PER_BRANCH = 4;      
const FLOWERS_PER_CLUSTER = 6;     
const ANIMATION_ENABLED = true;    
const ANIMATION_SPEED = 10;
const PARALLEL_BRANCHES = 10;
const SUPER_FAST_MODE = false;
const AWESOME_ANIMATION = true;

const AWESOME_BURST_PARTICLES = 200;
const AWESOME_GROWTH_DURATION = 2000;
const AWESOME_PARTICLES_COLOR = 0xFFD700;

window.addEventListener('load', init);
window.addEventListener('resize', onWindowResize);

function init() {
    try {
        console.log("Inizializzazione...");
        
        loadingElement = document.getElementById('loading');
        containerElement = document.getElementById('container');
        
        if (!loadingElement || !containerElement) {
            console.error("Elementi DOM non trovati!");
            hideLoading();
            return;
        }
        
        setupScene();
        
        animate();
        
        setTimeout(() => {
            hideLoading();
            startGeneration();
        }, 400);
    } catch (error) {
        console.error("Errore durante l'inizializzazione:", error);
        hideLoading();
    }
}

function hideLoading() {
    if (loadingElement) {
        loadingElement.style.opacity = '0';
        setTimeout(() => {
            loadingElement.style.display = 'none';
        }, 500);
    }
}

function setupScene() {
    try {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(BACKGROUND_COLOR);
        scene.fog = new THREE.FogExp2(BACKGROUND_COLOR, 0.02);
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        scene.add(directionalLight);
        
        const pointLight1 = new THREE.PointLight(0xFFD700, 1, 15);
        pointLight1.position.set(2, 8, 2);
        scene.add(pointLight1);
        
        const pointLight2 = new THREE.PointLight(0xFF9500, 0.8, 10);
        pointLight2.position.set(-3, 5, -2);
        scene.add(pointLight2);
        
        camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 8, 20);
        
        renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        try {
            renderer.outputEncoding = THREE.sRGBEncoding;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.2;
        } catch (e) {
            console.warn("Encoding avanzato non supportato:", e);
        }
        
        containerElement.appendChild(renderer.domElement);
        
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false;
        controls.minDistance = 5;
        controls.maxDistance = 50;
        controls.maxPolarAngle = Math.PI / 1.8;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.5;
        
        try {
            setupPostprocessing();
            postProcessingEnabled = true;
        } catch (e) {
            console.warn("Post-processing non supportato:", e);
            postProcessingEnabled = false;
        }
        
        flowerGroup = new THREE.Group();
        flowerGroup.position.y = -STEM_HEIGHT / 2;
        scene.add(flowerGroup);
        
        try {
            createStarryBackground();
        } catch (e) {
            console.warn("Sfondo stellato non creato:", e);
        }
    } catch (error) {
        console.error("Errore durante il setup della scena:", error);
        throw error;
    }
}

function setupPostprocessing() {
    try {
        if (!THREE.EffectComposer || !THREE.RenderPass || !THREE.ShaderPass || !THREE.UnrealBloomPass) {
            console.warn("Librerie di post-processing non disponibili");
            return;
        }
        
        const renderScene = new THREE.RenderPass(scene, camera);
        
        const bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5,
            0.8,
            0.2
        );
        
        bloomComposer = new THREE.EffectComposer(renderer);
        bloomComposer.renderToScreen = false;
        bloomComposer.addPass(renderScene);
        bloomComposer.addPass(bloomPass);
        
        const finalPass = new THREE.ShaderPass(
            new THREE.ShaderMaterial({
                uniforms: {
                    baseTexture: { value: null },
                    bloomTexture: { value: bloomComposer.renderTarget2.texture }
                },
                vertexShader: `
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform sampler2D baseTexture;
                    uniform sampler2D bloomTexture;
                    varying vec2 vUv;
                    void main() {
                        vec4 baseColor = texture2D(baseTexture, vUv);
                        vec4 bloomColor = texture2D(bloomTexture, vUv);
                        gl_FragColor = baseColor + bloomColor;
                    }
                `,
                defines: {}
            }), "baseTexture"
        );
        finalPass.needsSwap = true;
        
        finalComposer = new THREE.EffectComposer(renderer);
        finalComposer.addPass(renderScene);
        finalComposer.addPass(finalPass);
    } catch (error) {
        console.error("Errore durante il setup del post-processing:", error);
        throw error;
    }
}

function createStarryBackground() {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 2000;
    const starPositions = [];
    const starSizes = [];
    
    for (let i = 0; i < starCount; i++) {
        const x = (Math.random() - 0.5) * 200;
        const y = (Math.random() - 0.5) * 200;
        const z = (Math.random() - 0.5) * 200;
        
        starPositions.push(x, y, z);
        starSizes.push(Math.random() * 2 + 0.5);
    }
    
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('size', new THREE.Float32BufferAttribute(starSizes, 1));
    
    const starMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            color: { value: new THREE.Color(0xffffff) },
        },
        vertexShader: `
            attribute float size;
            uniform float time;
            varying float vSize;
            void main() {
                vSize = size;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            varying float vSize;
            void main() {
                vec2 xy = gl_PointCoord.xy - vec2(0.5);
                float radius = length(xy);
                if (radius > 0.5) discard;
                float opacity = 0.8 * (1.0 - radius * 2.0);
                gl_FragColor = vec4(color, opacity);
            }
        `,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
    });
    
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
}

function startGeneration() {
    isGenerating = true;
    animationProgress = 0;
    branchesGenerated = 0;
    totalBranchesToGenerate = NUM_BRANCHES;
    
    if (AWESOME_ANIMATION) {
        startAwesomeAnimation();
    } else if (SUPER_FAST_MODE) {
        generateStemFast();
    } else {
        generateStem();
    }
}

function generateStemFast() {
    const stemHeight = STEM_HEIGHT;
    const stemRadius = STEM_RADIUS;
    
    const curvePoints = [];
    for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const bendAmount = 0.4; 
        const x = Math.sin(t * Math.PI) * bendAmount;
        const y = stemHeight * t;
        const z = Math.cos(t * Math.PI * 0.5) * bendAmount * 0.5;
        curvePoints.push(new THREE.Vector3(x, y, z));
    }
    
    const stemCurve = new THREE.CatmullRomCurve3(curvePoints);
    const stemGeometry = new THREE.TubeGeometry(stemCurve, 16, stemRadius, 8, false);
    
    const stemMaterial = new THREE.MeshStandardMaterial({
        color: STEM_COLOR,
        roughness: 0.8,
        metalness: 0.2,
        flatShading: true
    });
    
    stemObject = new THREE.Mesh(stemGeometry, stemMaterial);
    stemObject.castShadow = true;
    stemObject.receiveShadow = true;
    stemObject.userData.curve = stemCurve;
    
    flowerGroup.add(stemObject);
    
    generateAllBranchesFast();
}

function generateStem() {
    const stemHeight = STEM_HEIGHT;
    const stemRadius = STEM_RADIUS;
    
    const curvePoints = [];
    for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const bendAmount = 0.4;
        const x = Math.sin(t * Math.PI) * bendAmount;
        const y = stemHeight * t;
        const z = Math.cos(t * Math.PI * 0.5) * bendAmount * 0.5;
        curvePoints.push(new THREE.Vector3(x, y, z));
    }
    
    const stemCurve = new THREE.CatmullRomCurve3(curvePoints);
    const stemGeometry = new THREE.TubeGeometry(stemCurve, 16, stemRadius, 8, false);
    
    const stemMaterial = new THREE.MeshStandardMaterial({
        color: STEM_COLOR,
        roughness: 0.8,
        metalness: 0.2,
        flatShading: true
    });
    
    stemObject = new THREE.Mesh(stemGeometry, stemMaterial);
    stemObject.castShadow = true;
    stemObject.receiveShadow = true;
    stemObject.userData.curve = stemCurve;
    
    if (ANIMATION_ENABLED) {
        stemObject.scale.set(1, 0, 1);
        flowerGroup.add(stemObject);
        
        const duration = 600;
        const startTime = Date.now();
        
        function animateStemGrowth() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            stemObject.scale.y = progress;
            
            if (progress < 1) {
                requestAnimationFrame(animateStemGrowth);
            } else {
                console.log("Stelo completato, inizia la generazione dei rami");
                setTimeout(() => {
                    generateBranchesSequentially();
                }, 300);
            }
        }
        
        animateStemGrowth();
    } else {
        flowerGroup.add(stemObject);
        generateBranchesSequentially();
    }
}

function generateAllBranchesFast() {
    const branches = prepareBranchPositions();
    
    branches.forEach(branch => {
        createBranchFast(branch.point, branch.direction, branch.angle, branch.scale);
    });
    
    setTimeout(() => {
        isGenerating = false;
        generationComplete = true;
    }, 500);
}

function createBranchFast(startPoint, direction, angle, scale) {
    const branchLength = (2 + Math.random()) * scale;
    
    const curvePoints = [];
    
    for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const bendX = Math.sin(t * Math.PI) * (Math.random() * 0.3 + 0.1);
        const bendZ = Math.cos(t * Math.PI) * (Math.random() * 0.3 + 0.1);
        
        const point = new THREE.Vector3().copy(startPoint);
        if (i > 0) {
            point.x += (direction.x * t * branchLength) + bendX;
            point.y += direction.y * t * branchLength;
            point.z += (direction.z * t * branchLength) + bendZ;
        }
        
        curvePoints.push(point);
    }
    
    const branchCurve = new THREE.CatmullRomCurve3(curvePoints);
    const branchGeometry = new THREE.TubeGeometry(
        branchCurve, 
        10, 
        STEM_RADIUS * 0.4 * scale, 
        8, 
        false
    );
    
    const branchMaterial = new THREE.MeshStandardMaterial({
        color: BRANCH_COLOR,
        roughness: 0.9,
        metalness: 0.1,
        flatShading: true
    });
    
    const branch = new THREE.Mesh(branchGeometry, branchMaterial);
    branch.castShadow = true;
    branch.receiveShadow = true;
    branch.userData.curve = branchCurve;
    branch.userData.scale = scale;
    
    flowerGroup.add(branch);
    
    addSecondaryBranchesFast(branch);
    
    addFlowersToBranchFast(branch, scale);
}

function addSecondaryBranchesFast(parentBranch) {
    if (!parentBranch.userData.curve) return;
    
    const parentCurve = parentBranch.userData.curve;
    const parentScale = parentBranch.userData.scale || 1.0;
    
    for (let i = 0; i < NUM_SECONDARY_BRANCHES; i++) {
        const t = 0.3 + (i / NUM_SECONDARY_BRANCHES) * 0.5;
        const pointOnParent = parentCurve.getPointAt(t);
        const tangentAtPoint = parentCurve.getTangentAt(t);
        
        const angle = Math.random() * Math.PI * 2;
        
        const up = new THREE.Vector3(0, 1, 0);
        const perpendicular = new THREE.Vector3().crossVectors(tangentAtPoint, up).normalize();
        
        const quaternion = new THREE.Quaternion().setFromAxisAngle(tangentAtPoint, angle);
        perpendicular.applyQuaternion(quaternion);
        
        const branchDirection = new THREE.Vector3()
            .addScaledVector(perpendicular, 0.8)
            .addScaledVector(new THREE.Vector3(0, 1, 0), 0.4)
            .normalize();
        
        const offsetPoint = new THREE.Vector3().copy(pointOnParent);
        const radius = parentBranch.geometry.parameters.radius * 0.9;
        offsetPoint.addScaledVector(perpendicular, radius);
        
        createSecondaryBranchFast(offsetPoint, branchDirection, angle, parentScale * 0.4);
    }
}

function createSecondaryBranchFast(startPoint, direction, angle, scale) {
    const branchLength = (0.8 + Math.random() * 0.6) * scale;
    
    const curvePoints = [];
    
    for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        const bendFactor = Math.random() * 0.15 * scale;
        const bendX = Math.sin(t * Math.PI) * bendFactor;
        const bendZ = Math.cos(t * Math.PI) * bendFactor;
        
        const point = new THREE.Vector3().copy(startPoint);
        if (i > 0) {
            point.x += (direction.x * t * branchLength) + bendX;
            point.y += direction.y * t * branchLength;
            point.z += (direction.z * t * branchLength) + bendZ;
        }
        
        curvePoints.push(point);
    }
    
    const branchCurve = new THREE.CatmullRomCurve3(curvePoints);
    const branchGeometry = new THREE.TubeGeometry(
        branchCurve, 
        6,
        STEM_RADIUS * 0.25 * scale, 
        6, 
        false
    );
    
    const branchMaterial = new THREE.MeshStandardMaterial({
        color: BRANCH_SECONDARY_COLOR,
        roughness: 0.9,
        metalness: 0.1,
        flatShading: true
    });
    
    const branch = new THREE.Mesh(branchGeometry, branchMaterial);
    branch.castShadow = true;
    branch.receiveShadow = true;
    branch.userData.curve = branchCurve;
    branch.userData.scale = scale;
    
    flowerGroup.add(branch);
    
    const endPoint = branchCurve.getPointAt(1);
    const endTangent = branchCurve.getTangentAt(1);
    createFlowerClusterFast(endPoint, endTangent, scale * 0.8);
    
    addTertiaryBranches(branch);
}

function addTertiaryBranches(parentBranch) {
    if (!parentBranch.userData.curve) return;
    
    const parentCurve = parentBranch.userData.curve;
    const parentScale = parentBranch.userData.scale || 1.0;
    
    for (let i = 0; i < NUM_TERTIARY_BRANCHES; i++) {
        const t = 0.4 + (i / NUM_TERTIARY_BRANCHES) * 0.4;
        const pointOnParent = parentCurve.getPointAt(t);
        const tangentAtPoint = parentCurve.getTangentAt(t);
        
        const angle = Math.random() * Math.PI * 2;
        
        const up = new THREE.Vector3(0, 1, 0);
        const perpendicular = new THREE.Vector3().crossVectors(tangentAtPoint, up).normalize();
        
        const quaternion = new THREE.Quaternion().setFromAxisAngle(tangentAtPoint, angle);
        perpendicular.applyQuaternion(quaternion);
        
        const branchDirection = new THREE.Vector3()
            .addScaledVector(perpendicular, 0.7)
            .addScaledVector(new THREE.Vector3(0, 1, 0), 0.5)
            .normalize();
        
        const offsetPoint = new THREE.Vector3().copy(pointOnParent);
        const radius = parentBranch.geometry.parameters.radius * 0.9;
        offsetPoint.addScaledVector(perpendicular, radius);
        
        createTertiaryBranch(offsetPoint, branchDirection, angle, parentScale * 0.6);
    }
}

function createTertiaryBranch(startPoint, direction, angle, scale) {
    const branchLength = (0.6 + Math.random() * 0.4) * scale;
    
    const curvePoints = [];
    
    for (let i = 0; i <= 3; i++) {
        const t = i / 3;
        const bendFactor = Math.random() * 0.1 * scale;
        const bendX = Math.sin(t * Math.PI) * bendFactor;
        const bendZ = Math.cos(t * Math.PI) * bendFactor;
        
        const point = new THREE.Vector3().copy(startPoint);
        if (i > 0) {
            point.x += (direction.x * t * branchLength) + bendX;
            point.y += direction.y * t * branchLength;
            point.z += (direction.z * t * branchLength) + bendZ;
        }
        
        curvePoints.push(point);
    }
    
    const branchCurve = new THREE.CatmullRomCurve3(curvePoints);
    const branchGeometry = new THREE.TubeGeometry(
        branchCurve, 
        4,
        STEM_RADIUS * 0.15 * scale, 
        5, 
        false
    );
    
    const branchMaterial = new THREE.MeshStandardMaterial({
        color: BRANCH_TERTIARY_COLOR,
        roughness: 0.9,
        metalness: 0.1,
        flatShading: true
    });
    
    const branch = new THREE.Mesh(branchGeometry, branchMaterial);
    branch.castShadow = true;
    branch.receiveShadow = true;
    
    flowerGroup.add(branch);
    
    const endPoint = branchCurve.getPointAt(1);
    const endTangent = branchCurve.getTangentAt(1);
    createFlowerClusterFast(endPoint, endTangent, scale * 0.7);
}

function addFlowersToBranchFast(branch, scale) {
    if (!branch.userData.curve) return;
    
    const branchCurve = branch.userData.curve;
    
    for (let i = 0; i < FLOWERS_PER_BRANCH; i++) {
        const t = 0.4 + (i / FLOWERS_PER_BRANCH) * 0.6;
        const pointOnBranch = branchCurve.getPointAt(t);
        const tangentAtPoint = branchCurve.getTangentAt(t);
        
        createFlowerClusterFast(pointOnBranch, tangentAtPoint, scale * 0.8);
    }
    
    const endPoint = branchCurve.getPointAt(1);
    const endTangent = branchCurve.getTangentAt(1);
    createFlowerClusterFast(endPoint, endTangent, scale);
}

function createFlowerClusterFast(position, direction, scale) {
    const clusterGroup = new THREE.Group();
    clusterGroup.position.copy(position);
    
    const upVector = new THREE.Vector3(0, 1, 0);
    const axis = new THREE.Vector3().crossVectors(upVector, direction).normalize();
    const angle = Math.acos(upVector.dot(direction));
    clusterGroup.setRotationFromAxisAngle(axis, angle);
    
    flowerGroup.add(clusterGroup);
    
    const flowerCount = Math.floor(Math.random() * 4) + FLOWERS_PER_CLUSTER;
    
    for (let i = 0; i < flowerCount; i++) {
        const phi = Math.acos(-1 + Math.random() * 2);
        const theta = Math.random() * Math.PI * 2;
        const radius = (0.2 + Math.random() * 0.3) * scale;
        
        const position = new THREE.Vector3(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.sin(phi) * Math.sin(theta),
            radius * Math.cos(phi)
        );
        
        createFlowerFast(clusterGroup, position, 0.08 * scale);
    }
}

function createFlowerFast(parentGroup, position, size) {
    const sphereGeo = new THREE.SphereGeometry(size, 8, 8);
    const sphereMat = new THREE.MeshStandardMaterial({
        color: FLOWER_COLOR,
        emissive: FLOWER_COLOR,
        emissiveIntensity: 0.5,
        roughness: 0.4,
        metalness: 0.6
    });
    
    const flower = new THREE.Mesh(sphereGeo, sphereMat);
    flower.castShadow = true;
    flower.position.copy(position);
    
    flower.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
    );
    
    const flowerScale = 0.8 + Math.random() * 0.4;
    flower.scale.set(flowerScale, flowerScale, flowerScale);
    
    parentGroup.add(flower);
}

function generateBranchesSequentially() {
    const branches = prepareBranchPositions();
    let currentGroupIndex = 0;
    
    const branchGroups = [];
    for (let i = 0; i < branches.length; i += PARALLEL_BRANCHES) {
        branchGroups.push(branches.slice(i, i + PARALLEL_BRANCHES));
    }
    
    function generateNextGroup() {
        if (currentGroupIndex >= branchGroups.length) {
            console.log("Tutti i gruppi di rami sono stati generati");
            setTimeout(() => {
                isGenerating = false;
                generationComplete = true;
            }, 300);
            return;
        }
        
        const currentGroup = branchGroups[currentGroupIndex];
        let branchesCompleteInGroup = 0;
        
        currentGroup.forEach(branch => {
            createBranch(branch.point, branch.direction, branch.angle, branch.scale, true, () => {
                branchesCompleteInGroup++;
                branchesGenerated++;
                
                if (branchesCompleteInGroup >= currentGroup.length) {
                    currentGroupIndex++;
                    setTimeout(generateNextGroup, 100);
                }
            });
        });
    }
    
    generateNextGroup();
}

function prepareBranchPositions() {
    if (!stemObject || !stemObject.userData.curve) {
        console.error("Stelo non disponibile o curva non definita");
        return [];
    }
    
    const stemCurve = stemObject.userData.curve;
    const branches = [];
    
    for (let i = 0; i < NUM_BRANCHES; i++) {
        const heightPercentage = 0.3 + (i / NUM_BRANCHES) * 0.7;
        
        const angle = (i * 137.5) * (Math.PI / 180);
        
        const pointOnStem = stemCurve.getPointAt(heightPercentage);
        const tangentAtPoint = stemCurve.getTangentAt(heightPercentage);
        
        const up = new THREE.Vector3(0, 1, 0);
        const axis = new THREE.Vector3().crossVectors(up, tangentAtPoint).normalize();
        const radialAngle = angle;
        
        const outwardDirection = new THREE.Vector3(
            Math.sin(radialAngle),
            0.3 + Math.random() * 0.3,
            Math.cos(radialAngle)
        ).normalize();
        
        const radiusOffset = stemObject.geometry.parameters.radius * 0.8;
        const startPoint = new THREE.Vector3().copy(pointOnStem);
        
        startPoint.x += outwardDirection.x * radiusOffset;
        startPoint.y += outwardDirection.y * radiusOffset;
        startPoint.z += outwardDirection.z * radiusOffset;
        
        branches.push({
            point: startPoint,
            direction: outwardDirection,
            angle: angle,
            scale: 1.0 - (i / NUM_BRANCHES) * 0.3,
            tangent: tangentAtPoint,
            heightPercentage: heightPercentage
        });
    }
    
    branches.sort((a, b) => a.heightPercentage - b.heightPercentage);
    
    return branches;
}

function createBranch(startPoint, direction, angle, scale, animate, onComplete) {
    const branchLength = (2 + Math.random()) * scale;
    
    const curvePoints = [];
    
    for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        
        const bendX = Math.sin(t * Math.PI) * (Math.random() * 0.3 + 0.1);
        const bendZ = Math.cos(t * Math.PI) * (Math.random() * 0.3 + 0.1);
        
        const point = new THREE.Vector3().copy(startPoint);
        if (i > 0) {
            point.x += (direction.x * t * branchLength) + bendX;
            point.y += direction.y * t * branchLength;
            point.z += (direction.z * t * branchLength) + bendZ;
        }
        
        curvePoints.push(point);
    }
    
    const branchCurve = new THREE.CatmullRomCurve3(curvePoints);
    const branchGeometry = new THREE.TubeGeometry(
        branchCurve, 
        10, 
        STEM_RADIUS * 0.4 * scale, 
        8, 
        false
    );
    
    const branchMaterial = new THREE.MeshStandardMaterial({
        color: BRANCH_COLOR,
        roughness: 0.9,
        metalness: 0.1,
        flatShading: true
    });
    
    const branch = new THREE.Mesh(branchGeometry, branchMaterial);
    branch.castShadow = true;
    branch.receiveShadow = true;
    branch.userData.curve = branchCurve;
    branch.userData.scale = scale;
    
    if (animate) {
        branch.scale.set(0, 0, 0);
        flowerGroup.add(branch);
        
        const duration = 400 / ANIMATION_SPEED;
        const startTime = Date.now();
        
        function animateBranchGrowth() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            branch.scale.set(progress, progress, progress);
            
            if (progress < 1) {
                requestAnimationFrame(animateBranchGrowth);
            } else {
                addSecondaryBranches(branch, () => {
                    addFlowersToBranch(branch, scale, animate, onComplete);
                });
            }
        }
        
        animateBranchGrowth();
    } else {
        flowerGroup.add(branch);
        addSecondaryBranches(branch, () => {
            addFlowersToBranch(branch, scale, animate, onComplete);
        });
    }
}

function addSecondaryBranches(parentBranch, onComplete) {
    if (!parentBranch.userData.curve) {
        console.error("Curva del ramo principale non disponibile");
        if (onComplete) onComplete();
        return;
    }
    
    const parentCurve = parentBranch.userData.curve;
    const parentScale = parentBranch.userData.scale || 1.0;
    const branchPositions = [];
    
    for (let i = 0; i < NUM_SECONDARY_BRANCHES; i++) {
        const t = 0.3 + (i / NUM_SECONDARY_BRANCHES) * 0.5;
        const pointOnParent = parentCurve.getPointAt(t);
        const tangentAtPoint = parentCurve.getTangentAt(t);
        
        const angle = Math.random() * Math.PI * 2;
        
        const up = new THREE.Vector3(0, 1, 0);
        const perpendicular = new THREE.Vector3().crossVectors(tangentAtPoint, up).normalize();
        
        const quaternion = new THREE.Quaternion().setFromAxisAngle(tangentAtPoint, angle);
        perpendicular.applyQuaternion(quaternion);
        
        const branchDirection = new THREE.Vector3()
            .addScaledVector(perpendicular, 0.8)
            .addScaledVector(new THREE.Vector3(0, 1, 0), 0.4)
            .normalize();
        
        const offsetPoint = new THREE.Vector3().copy(pointOnParent);
        const radius = parentBranch.geometry.parameters.radius * 0.9;
        offsetPoint.addScaledVector(perpendicular, radius);
        
        branchPositions.push({
            point: offsetPoint,
            direction: branchDirection,
            angle: angle,
            scale: parentScale * 0.4,
            t: t
        });
    }
    
    if (branchPositions.length === 0) {
        if (onComplete) onComplete();
        return;
    }
    
    let completedCount = 0;
    branchPositions.forEach(pos => {
        createSecondaryBranch(pos.point, pos.direction, pos.angle, pos.scale, ANIMATION_ENABLED, () => {
            completedCount++;
            if (completedCount >= branchPositions.length) {
                if (onComplete) onComplete();
            }
        });
    });
}

function createSecondaryBranch(startPoint, direction, angle, scale, animate, onComplete) {
    const branchLength = (0.8 + Math.random() * 0.6) * scale;
    
    const curvePoints = [];
    
    for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        
        const bendFactor = Math.random() * 0.15 * scale;
        const bendX = Math.sin(t * Math.PI) * bendFactor;
        const bendZ = Math.cos(t * Math.PI) * bendFactor;
        
        const point = new THREE.Vector3().copy(startPoint);
        if (i > 0) {
            point.x += (direction.x * t * branchLength) + bendX;
            point.y += direction.y * t * branchLength;
            point.z += (direction.z * t * branchLength) + bendZ;
        }
        
        curvePoints.push(point);
    }
    
    const branchCurve = new THREE.CatmullRomCurve3(curvePoints);
    const branchGeometry = new THREE.TubeGeometry(
        branchCurve, 
        6,
        STEM_RADIUS * 0.25 * scale, 
        6, 
        false
    );
    
    const branchMaterial = new THREE.MeshStandardMaterial({
        color: BRANCH_SECONDARY_COLOR,
        roughness: 0.9,
        metalness: 0.1,
        flatShading: true
    });
    
    const branch = new THREE.Mesh(branchGeometry, branchMaterial);
    branch.castShadow = true;
    branch.receiveShadow = true;
    branch.userData.curve = branchCurve;
    branch.userData.scale = scale;
    
    if (animate) {
        branch.scale.set(0, 0, 0);
        flowerGroup.add(branch);
        
        const duration = 300 / ANIMATION_SPEED;
        const startTime = Date.now();
        
        function animateGrowth() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            branch.scale.set(progress, progress, progress);
            
            if (progress < 1) {
                requestAnimationFrame(animateGrowth);
            } else {
                addTertiaryBranchesWithAnimation(branch, () => {
                    const endPoint = branchCurve.getPointAt(1);
                    const endTangent = branchCurve.getTangentAt(1);
                    createFlowerCluster(endPoint, endTangent, scale * 0.8, animate, onComplete);
                });
            }
        }
        
        animateGrowth();
    } else {
        flowerGroup.add(branch);
        
        addTertiaryBranches(branch);
        
        const endPoint = branchCurve.getPointAt(1);
        const endTangent = branchCurve.getTangentAt(1);
        createFlowerCluster(endPoint, endTangent, scale * 0.8, false, onComplete);
    }
}

function addTertiaryBranchesWithAnimation(parentBranch, onComplete) {
    if (!parentBranch.userData.curve) {
        if (onComplete) onComplete();
        return;
    }
    
    const parentCurve = parentBranch.userData.curve;
    const parentScale = parentBranch.userData.scale || 1.0;
    const branchPositions = [];
    
    for (let i = 0; i < NUM_TERTIARY_BRANCHES; i++) {
        const t = 0.4 + (i / NUM_TERTIARY_BRANCHES) * 0.4;
        const pointOnParent = parentCurve.getPointAt(t);
        const tangentAtPoint = parentCurve.getTangentAt(t);
        
        const angle = Math.random() * Math.PI * 2;
        
        const up = new THREE.Vector3(0, 1, 0);
        const perpendicular = new THREE.Vector3().crossVectors(tangentAtPoint, up).normalize();
        
        const quaternion = new THREE.Quaternion().setFromAxisAngle(tangentAtPoint, angle);
        perpendicular.applyQuaternion(quaternion);
        
        const branchDirection = new THREE.Vector3()
            .addScaledVector(perpendicular, 0.7)
            .addScaledVector(new THREE.Vector3(0, 1, 0), 0.5)
            .normalize();
        
        const offsetPoint = new THREE.Vector3().copy(pointOnParent);
        const radius = parentBranch.geometry.parameters.radius * 0.9;
        offsetPoint.addScaledVector(perpendicular, radius);
        
        branchPositions.push({
            point: offsetPoint,
            direction: branchDirection,
            angle: angle,
            scale: parentScale * 0.6
        });
    }
    
    if (branchPositions.length === 0) {
        if (onComplete) onComplete();
        return;
    }
    
    let completedCount = 0;
    
    branchPositions.forEach(pos => {
        createTertiaryBranchWithAnimation(pos.point, pos.direction, pos.angle, pos.scale, () => {
            completedCount++;
            if (completedCount >= branchPositions.length) {
                if (onComplete) onComplete();
            }
        });
    });
}

function createTertiaryBranchWithAnimation(startPoint, direction, angle, scale, onComplete) {
    const branchLength = (0.6 + Math.random() * 0.4) * scale;
    
    const curvePoints = [];
    
    for (let i = 0; i <= 3; i++) {
        const t = i / 3;
        const bendFactor = Math.random() * 0.1 * scale;
        const bendX = Math.sin(t * Math.PI) * bendFactor;
        const bendZ = Math.cos(t * Math.PI) * bendFactor;
        
        const point = new THREE.Vector3().copy(startPoint);
        if (i > 0) {
            point.x += (direction.x * t * branchLength) + bendX;
            point.y += direction.y * t * branchLength;
            point.z += (direction.z * t * branchLength) + bendZ;
        }
        
        curvePoints.push(point);
    }
    
    const branchCurve = new THREE.CatmullRomCurve3(curvePoints);
    const branchGeometry = new THREE.TubeGeometry(
        branchCurve, 
        4,
        STEM_RADIUS * 0.15 * scale, 
        5, 
        false
    );
    
    const branchMaterial = new THREE.MeshStandardMaterial({
        color: BRANCH_TERTIARY_COLOR,
        roughness: 0.9,
        metalness: 0.1,
        flatShading: true
    });
    
    const branch = new THREE.Mesh(branchGeometry, branchMaterial);
    branch.castShadow = true;
    branch.receiveShadow = true;
    branch.scale.set(0, 0, 0);
    
    flowerGroup.add(branch);
    
    const duration = 200 / ANIMATION_SPEED;
    const startTime = Date.now();
    
    function animateGrowth() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        branch.scale.set(progress, progress, progress);
        
        if (progress < 1) {
            requestAnimationFrame(animateGrowth);
        } else {
            const endPoint = branchCurve.getPointAt(1);
            const endTangent = branchCurve.getTangentAt(1);
            createFlowerCluster(endPoint, endTangent, scale * 0.7, true, onComplete);
        }
    }
    
    animateGrowth();
}

function addFlowersToBranch(branch, scale, animate, onComplete) {
    if (!branch.userData.curve) {
        console.error("Curva del ramo non disponibile");
        if (onComplete) onComplete();
        return;
    }
    
    const branchCurve = branch.userData.curve;
    const flowerClusters = [];
    
    for (let i = 0; i < FLOWERS_PER_BRANCH; i++) {
        const t = 0.4 + (i / FLOWERS_PER_BRANCH) * 0.6;
        const pointOnBranch = branchCurve.getPointAt(t);
        const tangentAtPoint = branchCurve.getTangentAt(t);
        
        flowerClusters.push({
            position: pointOnBranch,
            direction: tangentAtPoint,
            scale: scale * 0.8,
            t: t
        });
    }
    
    const endPoint = branchCurve.getPointAt(1);
    const endTangent = branchCurve.getTangentAt(1);
    
    flowerClusters.push({
        position: endPoint,
        direction: endTangent,
        scale: scale,
        t: 1
    });
    
    flowerClusters.sort((a, b) => a.t - b.t);
    
    let currentClusterIndex = 0;
    
    function createNextCluster() {
        if (currentClusterIndex >= flowerClusters.length) {
            if (onComplete) onComplete();
            return;
        }
        
        const cluster = flowerClusters[currentClusterIndex];
        
        if (animate) {
            createFlowerCluster(cluster.position, cluster.direction, cluster.scale, animate, () => {
                currentClusterIndex++;
                if (currentClusterIndex < flowerClusters.length) {
                    setTimeout(createNextCluster, 50 / ANIMATION_SPEED);
                } else {
                    if (onComplete) onComplete();
                }
            });
        } else {
            for (const cluster of flowerClusters) {
                createFlowerCluster(cluster.position, cluster.direction, cluster.scale, false);
            }
            if (onComplete) onComplete();
        }
    }
    
    createNextCluster();
}

function createFlowerCluster(position, direction, scale, animate, onComplete) {
    const clusterGroup = new THREE.Group();
    clusterGroup.position.copy(position);
    
    const upVector = new THREE.Vector3(0, 1, 0);
    const axis = new THREE.Vector3().crossVectors(upVector, direction).normalize();
    const angle = Math.acos(upVector.dot(direction));
    clusterGroup.setRotationFromAxisAngle(axis, angle);
    
    flowerGroup.add(clusterGroup);
    
    const flowerCount = Math.floor(Math.random() * 5) + FLOWERS_PER_CLUSTER;
    
    const flowerPositions = [];
    for (let i = 0; i < flowerCount; i++) {
        const phi = Math.acos(-1 + Math.random() * 2);
        const theta = Math.random() * Math.PI * 2;
        const radius = (0.2 + Math.random() * 0.3) * scale;
        
        const position = new THREE.Vector3(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.sin(phi) * Math.sin(theta),
            radius * Math.cos(phi)
        );
        
        flowerPositions.push(position);
    }
    
    let currentFlowerIndex = 0;
    
    function createNextFlower() {
        if (currentFlowerIndex >= flowerPositions.length) {
            if (onComplete) onComplete();
            return;
        }
        
        const position = flowerPositions[currentFlowerIndex];
        
        if (animate) {
            createFlower(clusterGroup, position, 0.08 * scale, animate, () => {
                currentFlowerIndex++;
                if (currentFlowerIndex < flowerPositions.length) {
                    setTimeout(createNextFlower, 20 / ANIMATION_SPEED);
                } else {
                    if (onComplete) onComplete();
                }
            });
        } else {
            for (const position of flowerPositions) {
                createFlower(clusterGroup, position, 0.08 * scale, false);
            }
            if (onComplete) onComplete();
        }
    }
    
    createNextFlower();
}

function createFlower(parentGroup, position, size, animate, onComplete) {
    const sphereGeo = new THREE.SphereGeometry(size, 8, 8);
    const sphereMat = new THREE.MeshStandardMaterial({
        color: FLOWER_COLOR,
        emissive: FLOWER_COLOR,
        emissiveIntensity: 0.5,
        roughness: 0.4,
        metalness: 0.6
    });
    
    const flower = new THREE.Mesh(sphereGeo, sphereMat);
    flower.castShadow = true;
    flower.position.copy(position);
    
    flower.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
    );
    
    const flowerScale = 0.8 + Math.random() * 0.4;
    
    if (animate) {
        flower.scale.set(0, 0, 0);
        parentGroup.add(flower);
        
        const duration = 100 / ANIMATION_SPEED;
        const startTime = Date.now();
        
        function animateFlowerGrowth() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const scaleValue = flowerScale * progress;
            flower.scale.set(scaleValue, scaleValue, scaleValue);
            
            if (progress < 1) {
                requestAnimationFrame(animateFlowerGrowth);
            } else {
                if (onComplete) onComplete();
            }
        }
        
        animateFlowerGrowth();
    } else {
        flower.scale.set(flowerScale, flowerScale, flowerScale);
        parentGroup.add(flower);
        if (onComplete) onComplete();
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    try {
        const delta = clock.getDelta();
        const elapsedTime = clock.getElapsedTime();
        
        if (controls) {
            controls.update();
        }
        
        if (flowerGroup) {
            flowerGroup.rotation.y = Math.sin(elapsedTime * 0.2) * 0.1;
            flowerGroup.position.y = -STEM_HEIGHT / 2 + Math.sin(elapsedTime * 0.5) * 0.2;
        }
        
        if (postProcessingEnabled && bloomComposer && finalComposer) {
            try {
                bloomComposer.render();
                finalComposer.render();
            } catch (e) {
                console.warn("Errore nel rendering con post-processing, torno al rendering standard:", e);
                postProcessingEnabled = false;
                renderer.render(scene, camera);
            }
        } else {
            renderer.render(scene, camera);
        }
    } catch (error) {
        console.error("Errore durante l'animazione:", error);
    }
}

function onWindowResize() {
    try {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        
        if (postProcessingEnabled && bloomComposer && finalComposer) {
            bloomComposer.setSize(window.innerWidth, window.innerHeight);
            finalComposer.setSize(window.innerWidth, window.innerHeight);
        }
    } catch (error) {
        console.error("Errore durante il ridimensionamento:", error);
    }
}

function startAwesomeAnimation() {
    createBurstEffect();
    
    generateCompleteFlowerModel();
    
    setTimeout(() => {
        startAwesomeGrowthAnimation();
    }, 300);
}

function createBurstEffect() {
    const burstGroup = new THREE.Group();
    scene.add(burstGroup);
    
    for (let i = 0; i < 150; i++) {
        const phi = Math.acos(-1 + Math.random() * 2);
        const theta = Math.random() * Math.PI * 2;
        
        const smallOffset = 0.05;
        const initialOffset = new THREE.Vector3(
            (Math.random() - 0.5) * smallOffset,
            (Math.random() - 0.5) * smallOffset,
            (Math.random() - 0.5) * smallOffset
        );
        const position = new THREE.Vector3().copy(initialOffset);
        
        const direction = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.sin(phi) * Math.sin(theta),
            Math.cos(phi)
        ).normalize();
        
        const minSpeed = 0.1;
        const speed = minSpeed + Math.random() * 0.15;
        
        const size = 0.05 + Math.random() * 0.15;
        const geometry = new THREE.SphereGeometry(size, 6, 6);
        
        const colorIndex = Math.floor(Math.random() * PARTICLE_COLORS.length);
        const color = PARTICLE_COLORS[colorIndex];
        
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.8,
            roughness: 0.3,
            metalness: 0.8,
            transparent: true,
            opacity: 0.8
        });
        
        const particle = new THREE.Mesh(geometry, material);
        particle.position.copy(position);
        burstGroup.add(particle);
        
        particles.push({
            mesh: particle,
            direction: direction,
            speed: speed,
            life: 1.0,
            decay: 0.12 + Math.random() * 0.08
        });
        
        particleCount++;
    }
    
    setTimeout(() => {
        if (burstGroup.parent) {
            burstGroup.parent.remove(burstGroup);
        }
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            if (p.mesh.parent) {
                p.mesh.parent.remove(p.mesh);
            } else {
                scene.remove(p.mesh);
            }
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            particles.splice(i, 1);
        }
    }, 3000);
}

function generateCompleteFlowerModel() {
    createStemModel();
    
    const branches = prepareBranchPositions();
    branches.forEach(branch => {
        createBranchModel(branch.point, branch.direction, branch.angle, branch.scale);
    });
    
    allMeshes.forEach(mesh => {
        mesh.visible = false;
    });
}

function createStemModel() {
    const stemHeight = STEM_HEIGHT;
    const stemRadius = STEM_RADIUS;
    
    const curvePoints = [];
    for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const bendAmount = 0.4; 
        const x = Math.sin(t * Math.PI) * bendAmount;
        const y = stemHeight * t;
        const z = Math.cos(t * Math.PI * 0.5) * bendAmount * 0.5;
        curvePoints.push(new THREE.Vector3(x, y, z));
    }
    
    const stemCurve = new THREE.CatmullRomCurve3(curvePoints);
    const stemGeometry = new THREE.TubeGeometry(stemCurve, 16, stemRadius, 8, false);
    
    const stemMaterial = new THREE.MeshStandardMaterial({
        color: STEM_COLOR,
        roughness: 0.8,
        metalness: 0.2,
        flatShading: true
    });
    
    stemObject = new THREE.Mesh(stemGeometry, stemMaterial);
    stemObject.castShadow = true;
    stemObject.receiveShadow = true;
    stemObject.userData.curve = stemCurve;
    stemObject.userData.type = 'stem';
    stemObject.userData.level = 0;
    
    flowerGroup.add(stemObject);
    allMeshes.push(stemObject);
}

function createBranchModel(startPoint, direction, angle, scale) {
    const branchLength = (2 + Math.random()) * scale;
    
    const curvePoints = [];
    for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const bendX = Math.sin(t * Math.PI) * (Math.random() * 0.3 + 0.1);
        const bendZ = Math.cos(t * Math.PI) * (Math.random() * 0.3 + 0.1);
        
        const point = new THREE.Vector3().copy(startPoint);
        if (i > 0) {
            point.x += (direction.x * t * branchLength) + bendX;
            point.y += direction.y * t * branchLength;
            point.z += (direction.z * t * branchLength) + bendZ;
        }
        
        curvePoints.push(point);
    }
    
    const branchCurve = new THREE.CatmullRomCurve3(curvePoints);
    const branchGeometry = new THREE.TubeGeometry(
        branchCurve, 
        10, 
        STEM_RADIUS * 0.4 * scale, 
        8, 
        false
    );
    
    const branchMaterial = new THREE.MeshStandardMaterial({
        color: BRANCH_COLOR,
        roughness: 0.9,
        metalness: 0.1,
        flatShading: true
    });
    
    const branch = new THREE.Mesh(branchGeometry, branchMaterial);
    branch.castShadow = true;
    branch.receiveShadow = true;
    branch.userData.curve = branchCurve;
    branch.userData.scale = scale;
    branch.userData.type = 'primary-branch';
    branch.userData.level = 1;
    
    flowerGroup.add(branch);
    allMeshes.push(branch);
    
    createSecondaryBranchesModel(branch);
    
    createFlowersOnBranchModel(branch, scale);
}

function createSecondaryBranchesModel(parentBranch) {
    if (!parentBranch.userData.curve) return;
    
    const parentCurve = parentBranch.userData.curve;
    const parentScale = parentBranch.userData.scale || 1.0;
    
    for (let i = 0; i < NUM_SECONDARY_BRANCHES; i++) {
        const t = 0.3 + (i / NUM_SECONDARY_BRANCHES) * 0.5;
        const pointOnParent = parentCurve.getPointAt(t);
        const tangentAtPoint = parentCurve.getTangentAt(t);
        
        const angle = Math.random() * Math.PI * 2;
        
        const up = new THREE.Vector3(0, 1, 0);
        const perpendicular = new THREE.Vector3().crossVectors(tangentAtPoint, up).normalize();
        
        const quaternion = new THREE.Quaternion().setFromAxisAngle(tangentAtPoint, angle);
        perpendicular.applyQuaternion(quaternion);
        
        const branchDirection = new THREE.Vector3()
            .addScaledVector(perpendicular, 0.8)
            .addScaledVector(new THREE.Vector3(0, 1, 0), 0.4)
            .normalize();
        
        const offsetPoint = new THREE.Vector3().copy(pointOnParent);
        const radius = parentBranch.geometry.parameters.radius * 0.9;
        offsetPoint.addScaledVector(perpendicular, radius);
        
        createSecondaryBranchModel(offsetPoint, branchDirection, angle, parentScale * 0.4);
    }
}

function createSecondaryBranchModel(startPoint, direction, angle, scale) {
    const branchLength = (0.8 + Math.random() * 0.6) * scale;
    
    const curvePoints = [];
    for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        const bendFactor = Math.random() * 0.15 * scale;
        const bendX = Math.sin(t * Math.PI) * bendFactor;
        const bendZ = Math.cos(t * Math.PI) * bendFactor;
        
        const point = new THREE.Vector3().copy(startPoint);
        if (i > 0) {
            point.x += (direction.x * t * branchLength) + bendX;
            point.y += direction.y * t * branchLength;
            point.z += (direction.z * t * branchLength) + bendZ;
        }
        
        curvePoints.push(point);
    }
    
    const branchCurve = new THREE.CatmullRomCurve3(curvePoints);
    const branchGeometry = new THREE.TubeGeometry(
        branchCurve, 
        6,
        STEM_RADIUS * 0.25 * scale, 
        6, 
        false
    );
    
    const branchMaterial = new THREE.MeshStandardMaterial({
        color: BRANCH_SECONDARY_COLOR,
        roughness: 0.9,
        metalness: 0.1,
        flatShading: true
    });
    
    const branch = new THREE.Mesh(branchGeometry, branchMaterial);
    branch.castShadow = true;
    branch.receiveShadow = true;
    branch.userData.curve = branchCurve;
    branch.userData.scale = scale;
    branch.userData.type = 'secondary-branch';
    branch.userData.level = 2;
    
    flowerGroup.add(branch);
    allMeshes.push(branch);
    
    const endPoint = branchCurve.getPointAt(1);
    const endTangent = branchCurve.getTangentAt(1);
    createFlowerClusterModel(endPoint, endTangent, scale * 0.8);
    
    createTertiaryBranchesModel(branch);
}

function createTertiaryBranchesModel(parentBranch) {
    if (!parentBranch.userData.curve) return;
    
    const parentCurve = parentBranch.userData.curve;
    const parentScale = parentBranch.userData.scale || 1.0;
    
    for (let i = 0; i < NUM_TERTIARY_BRANCHES; i++) {
        const t = 0.4 + (i / NUM_TERTIARY_BRANCHES) * 0.4;
        const pointOnParent = parentCurve.getPointAt(t);
        const tangentAtPoint = parentCurve.getTangentAt(t);
        
        const angle = Math.random() * Math.PI * 2;
        
        const up = new THREE.Vector3(0, 1, 0);
        const perpendicular = new THREE.Vector3().crossVectors(tangentAtPoint, up).normalize();
        
        const quaternion = new THREE.Quaternion().setFromAxisAngle(tangentAtPoint, angle);
        perpendicular.applyQuaternion(quaternion);
        
        const branchDirection = new THREE.Vector3()
            .addScaledVector(perpendicular, 0.7)
            .addScaledVector(new THREE.Vector3(0, 1, 0), 0.5)
            .normalize();
        
        const offsetPoint = new THREE.Vector3().copy(pointOnParent);
        const radius = parentBranch.geometry.parameters.radius * 0.9;
        offsetPoint.addScaledVector(perpendicular, radius);
        
        createTertiaryBranchModel(offsetPoint, branchDirection, angle, parentScale * 0.6);
    }
}

function createTertiaryBranchModel(startPoint, direction, angle, scale) {
    const branchLength = (0.6 + Math.random() * 0.4) * scale;
    
    const curvePoints = [];
    for (let i = 0; i <= 3; i++) {
        const t = i / 3;
        const bendFactor = Math.random() * 0.1 * scale;
        const bendX = Math.sin(t * Math.PI) * bendFactor;
        const bendZ = Math.cos(t * Math.PI) * bendFactor;
        
        const point = new THREE.Vector3().copy(startPoint);
        if (i > 0) {
            point.x += (direction.x * t * branchLength) + bendX;
            point.y += direction.y * t * branchLength;
            point.z += (direction.z * t * branchLength) + bendZ;
        }
        
        curvePoints.push(point);
    }
    
    const branchCurve = new THREE.CatmullRomCurve3(curvePoints);
    const branchGeometry = new THREE.TubeGeometry(
        branchCurve, 
        4,
        STEM_RADIUS * 0.15 * scale, 
        5, 
        false
    );
    
    const branchMaterial = new THREE.MeshStandardMaterial({
        color: BRANCH_TERTIARY_COLOR,
        roughness: 0.9,
        metalness: 0.1,
        flatShading: true
    });
    
    const branch = new THREE.Mesh(branchGeometry, branchMaterial);
    branch.castShadow = true;
    branch.receiveShadow = true;
    branch.userData.type = 'tertiary-branch';
    branch.userData.level = 3;
    
    flowerGroup.add(branch);
    allMeshes.push(branch);
    
    const endPoint = branchCurve.getPointAt(1);
    const endTangent = branchCurve.getTangentAt(1);
    createFlowerClusterModel(endPoint, endTangent, scale * 0.7);
}

function createFlowersOnBranchModel(branch, scale) {
    if (!branch.userData.curve) return;
    
    const branchCurve = branch.userData.curve;
    
    for (let i = 0; i < FLOWERS_PER_BRANCH; i++) {
        const t = 0.4 + (i / FLOWERS_PER_BRANCH) * 0.6;
        const pointOnBranch = branchCurve.getPointAt(t);
        const tangentAtPoint = branchCurve.getTangentAt(t);
        
        createFlowerClusterModel(pointOnBranch, tangentAtPoint, scale * 0.8);
    }
    
    const endPoint = branchCurve.getPointAt(1);
    const endTangent = branchCurve.getTangentAt(1);
    createFlowerClusterModel(endPoint, endTangent, scale);
}

function createFlowerClusterModel(position, direction, scale) {
    const clusterGroup = new THREE.Group();
    clusterGroup.position.copy(position);
    
    const upVector = new THREE.Vector3(0, 1, 0);
    const axis = new THREE.Vector3().crossVectors(upVector, direction).normalize();
    const angle = Math.acos(upVector.dot(direction));
    clusterGroup.setRotationFromAxisAngle(axis, angle);
    clusterGroup.userData.type = 'flower-cluster';
    clusterGroup.userData.level = 4;
    
    flowerGroup.add(clusterGroup);
    allMeshes.push(clusterGroup);
    
    const flowerCount = Math.floor(Math.random() * 4) + FLOWERS_PER_CLUSTER;
    
    for (let i = 0; i < flowerCount; i++) {
        const phi = Math.acos(-1 + Math.random() * 2);
        const theta = Math.random() * Math.PI * 2;
        const radius = (0.2 + Math.random() * 0.3) * scale;
        
        const position = new THREE.Vector3(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.sin(phi) * Math.sin(theta),
            radius * Math.cos(phi)
        );
        
        createFlowerModel(clusterGroup, position, 0.08 * scale);
    }
}

function createFlowerModel(parentGroup, position, size) {
    const sphereGeo = new THREE.SphereGeometry(size, 8, 8);
    const sphereMat = new THREE.MeshStandardMaterial({
        color: FLOWER_COLOR,
        emissive: FLOWER_COLOR,
        emissiveIntensity: 0.5,
        roughness: 0.4,
        metalness: 0.6
    });
    
    const flower = new THREE.Mesh(sphereGeo, sphereMat);
    flower.castShadow = true;
    flower.position.copy(position);
    flower.userData.type = 'flower';
    flower.userData.level = 5;
    
    flower.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
    );
    
    const flowerScale = 0.8 + Math.random() * 0.4;
    flower.scale.set(flowerScale, flowerScale, flowerScale);
    
    parentGroup.add(flower);
    allMeshes.push(flower);
}

function startAwesomeGrowthAnimation() {
    const startTime = Date.now();
    const totalDuration = AWESOME_GROWTH_DURATION;
    
    function animateGrowth() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / totalDuration, 1);
        
        allMeshes.forEach(mesh => {
            const level = mesh.userData.level || 0;
            const levelStart = level * 0.15;
            const levelDuration = 0.3;
            
            let levelProgress = (progress - levelStart) / levelDuration;
            levelProgress = Math.max(0, Math.min(1, levelProgress));
            
            if (levelProgress > 0) {
                mesh.visible = true;
                
                if (levelProgress < 1) {
                    const scaleValue = levelProgress;
                    mesh.scale.set(scaleValue, scaleValue, scaleValue);
                } else {
                    mesh.scale.set(1, 1, 1);
                }
            } else {
                mesh.visible = false;
            }
        });
        
        if (progress < 1) {
            requestAnimationFrame(animateGrowth);
        } else {
            isGenerating = false;
            generationComplete = true;
        }
    }
    
    animateGrowth();
}

function addGrowthParticleAt(mesh) {
    if (!mesh || !mesh.geometry) return;
    
    const positionAttribute = mesh.geometry.getAttribute('position');
    if (!positionAttribute) return;
    
    const randomIndex = Math.floor(Math.random() * positionAttribute.count);
    const x = positionAttribute.getX(randomIndex);
    const y = positionAttribute.getY(randomIndex);
    const z = positionAttribute.getZ(randomIndex);
    
    const position = new THREE.Vector3(x, y, z);
    mesh.localToWorld(position);
    
    let particleColor;
    if (mesh.userData.type === 'stem' || mesh.userData.type?.includes('branch')) {
        const mixFactor = Math.random() * 0.5;
        const baseColor = mesh.material.color.clone();
        particleColor = baseColor.lerp(new THREE.Color(FLOWER_COLOR), mixFactor);
    } else {
        const colorIndex = Math.floor(Math.random() * PARTICLE_COLORS.length);
        particleColor = PARTICLE_COLORS[colorIndex];
    }
    
    const size = 0.03 + Math.random() * 0.08;
    const geometry = new THREE.SphereGeometry(size, 6, 6);
    const material = new THREE.MeshStandardMaterial({
        color: particleColor,
        emissive: particleColor,
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.8
    });
    
    const particle = new THREE.Mesh(geometry, material);
    particle.position.copy(position);
    scene.add(particle);
    
    const direction = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
    ).normalize().multiplyScalar(0.03);
    
    particles.push({
        mesh: particle,
        direction: direction,
        speed: 0.01 + Math.random() * 0.02,
        life: 1.0,
        decay: 0.1 + Math.random() * 0.1
    });
    
    particleCount++;
}

function updateParticles(deltaTime) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        
        p.mesh.position.x += p.direction.x * p.speed;
        p.mesh.position.y += p.direction.y * p.speed;
        p.mesh.position.z += p.direction.z * p.speed;
        
        p.life -= p.decay * 1.5;
        
        if (p.mesh.material) {
            p.mesh.material.opacity = p.life;
            p.mesh.scale.set(p.life, p.life, p.life);
        }
        
        if (p.life <= 0) {
            if (p.mesh.parent) {
                p.mesh.parent.remove(p.mesh);
            } else {
                scene.remove(p.mesh);
            }
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            particles.splice(i, 1);
        }
    }
}