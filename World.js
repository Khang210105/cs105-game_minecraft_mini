import * as THREE from 'three';
import { BLOCK_TYPES } from './blocks.js';

export class World {
    constructor(blockEngine) {
        this.engine = blockEngine;
        this.blocks = [];
        this.blockMap = new Map();

        // Hiệu ứng particles
        this.particles = [];
        this.particleGeometries = [
            new THREE.BoxGeometry(0.1, 0.1, 0.1),
            new THREE.BoxGeometry(0.15, 0.15, 0.15),
            new THREE.BoxGeometry(0.2, 0.2, 0.2),
            new THREE.BoxGeometry(0.25, 0.25, 0.25),
        ];
        this.textureImageCache = new Map();
        this.textureLoader = new THREE.TextureLoader();

        // Hệ thống chất lỏng
        this.activeFluids = [];
        this.fluidTickTimer = 0;
        this.animatingFluids = [];
        this.activeLavaBlocks = [];
        this.lavaPopTimer = 0;

        // Sky & Day/Night
        this.cameraWorldPos = new THREE.Vector3();
        this.skyColorDay = new THREE.Color(0x87ceeb);     // xanh ban ngày
        this.skyColorNight = new THREE.Color(0x0b1026);   // xanh đêm
        this.timeOfDay = Math.PI / 4;
        this.enableDayNightCycle = true;

        // Khởi tạo môi trường: ánh sáng, sun, ambient...
        this.initEnvironmentObjects();
        this.createVoxelClouds();
    }

    // ==============================
    // SETUP SUN, AMBIENT, CLOUDS
    // ==============================
    initEnvironmentObjects() {
        // Sun directional light
        this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.sunLight.castShadow = true;
        this.sunLight.position.set(12, 18, 8);
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 100;
        this.sunLight.shadow.camera.left = -40;
        this.sunLight.shadow.camera.right = 40;
        this.sunLight.shadow.camera.top = 40;
        this.sunLight.shadow.camera.bottom = -40;
        this.sunLight.shadow.bias = -0.0005;
        this.sunLight.target.position.set(0, 0, 0);
        this.engine.scene.add(this.sunLight);
        this.engine.scene.add(this.sunLight.target);

        // Sphere sun mesh
        this.sunMesh = new THREE.Mesh(
            new THREE.SphereGeometry(1.8, 32, 32),
            new THREE.MeshBasicMaterial({ color: 0xffdd66 })
        );
        this.sunMesh.position.copy(this.sunLight.position);
        this.engine.scene.add(this.sunMesh);

        // Ambient
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
        this.engine.scene.add(this.ambientLight);
    }

    createVoxelClouds() {
        this.cloudGroup = new THREE.Group();
        this.cloudGroup.position.y = 70;
        const cloudGeo = new THREE.BoxGeometry(4, 2, 4);
        const cloudMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8,
            depthWrite: false
        });

        const numClusters = 25;
        const spread = 250;
        for (let c = 0; c < numClusters; c++) {
            const cx = (Math.random() - 0.5) * spread;
            const cz = (Math.random() - 0.5) * spread;
            const blocks = 8 + Math.floor(Math.random() * 10);
            for (let i = 0; i < blocks; i++) {
                const cloudBlock = new THREE.Mesh(cloudGeo, cloudMat);
                cloudBlock.position.set(
                    cx + (Math.random() - 0.5) * 15,
                    Math.floor((Math.random() - 0.5) * 2) * 2,
                    cz + (Math.random() - 0.5) * 15
                );
                this.cloudGroup.add(cloudBlock);
            }
        }
        this.engine.scene.add(this.cloudGroup);
    }

    // ==============================
    // NGÀY/ĐÊM & MẶT TRỜI (BÁM THEO NGƯỜI CHƠI)
    // ==============================
    updateDayNightCycle(delta, scene, camera) {
        if (!this.enableDayNightCycle) return;

        this.timeOfDay += delta * 0.03; 
        const radius = 60; // Bán kính mặt trời (nới rộng ra cho đẹp)
        
        // 1. Lấy vị trí thực tế của người chơi
        camera.getWorldPosition(this.cameraWorldPos);
        const px = this.cameraWorldPos.x;
        const py = this.cameraWorldPos.y;
        const pz = this.cameraWorldPos.z;

        // 2. Tính quỹ đạo xoay quanh người chơi
        const x = px + radius * Math.cos(this.timeOfDay);
        const y = py + radius * Math.sin(this.timeOfDay);
        const z = pz; // Xoay thẳng qua đỉnh đầu

        this.sunLight.position.set(x, y, z);
        this.sunMesh.position.copy(this.sunLight.position);
        
        // 3. Bắt ánh sáng luôn chĩa vào người chơi để không bao giờ mất Shadow
        this.sunLight.target.position.set(px, py, pz);
        this.sunLight.target.updateMatrixWorld();

        // 4. Đổi màu trời mượt mà dựa trên độ cao của mặt trời
        const daylight = Math.max(0, Math.min(1, (y - py) / radius + 0.2)); 
        scene.background = new THREE.Color().lerpColors(
            this.skyColorNight,
            this.skyColorDay,
            daylight
        );

        this.sunLight.intensity = 0.15 + daylight * 1.05;
        this.ambientLight.intensity = 0.15 + daylight * 0.3;
    }

    // ==============================
    // QUẢN LÝ BLOCK
    // ==============================
    getKey(x, y, z) { return `${Math.round(x)},${Math.round(y)},${Math.round(z)}`; }
    getBlock(x, y, z) { return this.blockMap.get(this.getKey(x, y, z)); }

    generate(size = 50) {
        const half = Math.floor(size / 2);
        for (let x = -half; x < half; x++) {
            for (let z = -half; z < half; z++) {
                this.addBlock(x, 0, z, BLOCK_TYPES.GRASS);
            }
        }
    }

    addBlock(x, y, z, type, flowLevel = null, isSource = false) {
        x = Math.round(x);
        y = Math.round(y);
        z = Math.round(z);

        const existingBlock = this.getBlock(x, y, z);
        if (existingBlock) {
            if (existingBlock.userData.type.solid) return null; 
            
            // --- XỬ LÝ VA CHẠM TẠI KHỐI NƯỚC/LAVA ---
            if (existingBlock.userData.type.isFluid) {
                // 1. Nước chảy vào nước -> Giữ nguyên (Ruộng bậc thang)
                if (type.isFluid) {
                    if (flowLevel === null || isSource) {
                        existingBlock.userData.isSource = true;
                        existingBlock.userData.flowLevel = type.maxFlow;
                        existingBlock.userData.targetHeight = 1.0;
                    } else if (flowLevel !== null && existingBlock.userData.flowLevel < flowLevel) {
                        existingBlock.userData.flowLevel = flowLevel;
                        existingBlock.userData.targetHeight = Math.max(0.1, (flowLevel / type.maxFlow) * 0.9);
                    }
                    return existingBlock; 
                }

                // 2. CHỈ CHỈNH SỬA Ở ĐÂY: Đặt đất đè lên nước -> CHỈ xóa khối nước đó
                this.removeBlock(existingBlock);
                // (Đã xóa hoàn toàn cái clearWaterNetwork gây lỗi)
                
            } else {
                this.removeBlock(existingBlock); 
            }
        }

        const newBlock = this.engine.createBlock(x, y, z, type);
        
        // --- THÊM BÓNG ĐỔ VÀO ĐÂY ---
        newBlock.castShadow = true;
        newBlock.receiveShadow = true;
        
        newBlock.userData.gridPos = { x, y, z };
        
        this.blocks.push(newBlock);
        const key = this.getKey(x, y, z);
        this.blockMap.set(key, newBlock);

        // --- HỆ THỐNG CAO ĐỘ NƯỚC/LAVA CHUẨN XÁC ---
        if (type.isFluid) {
            newBlock.userData.flowLevel = flowLevel !== null ? flowLevel : type.maxFlow;
            newBlock.userData.isSource = (flowLevel === null) || isSource;
            
            const targetHeight = Math.max(0.1, (newBlock.userData.flowLevel / type.maxFlow) * 0.9);
            newBlock.userData.targetHeight = targetHeight;

            const blockAbove = this.getBlock(x, y + 1, z);
            if (blockAbove && blockAbove.userData.type.isFluid) {
                newBlock.userData.targetHeight = 1.0;
                newBlock.scale.set(1, 1.0, 1);
                newBlock.position.y = y; 
            } else {
                if (newBlock.userData.isSource) {
                    newBlock.scale.set(1, targetHeight, 1);
                    newBlock.position.y = y - (1 - targetHeight) / 2;
                } else {
                    newBlock.scale.set(1, 0.01, 1);
                    newBlock.position.y = y - (1 - 0.01) / 2;
                    this.animatingFluids.push(newBlock);
                }
            }

            const blockBelow = this.getBlock(x, y - 1, z);
            if (blockBelow && blockBelow.userData.type.isFluid) {
                blockBelow.userData.targetHeight = 1.0;
                blockBelow.scale.set(1, 1.0, 1);
                blockBelow.position.y = y - 1; 
                
                const animIndex = this.animatingFluids.indexOf(blockBelow);
                if (animIndex > -1) {
                    this.animatingFluids.splice(animIndex, 1);
                }
            }

            this.activeFluids.push(newBlock); 
        }

        if (type.id === BLOCK_TYPES.LAVA.id) {
            this.activeLavaBlocks.push(newBlock);
        }

        return newBlock;
    }

    removeBlock(mesh) {
        if (!mesh) return;

        // 1. Dùng tọa độ Grid CHUẨN XÁC để tránh lỗi "Nước bóng ma"
        const x = mesh.userData.gridPos ? mesh.userData.gridPos.x : Math.round(mesh.position.x);
        const y = mesh.userData.gridPos ? mesh.userData.gridPos.y : Math.round(mesh.position.y);
        const z = mesh.userData.gridPos ? mesh.userData.gridPos.z : Math.round(mesh.position.z);

        this.engine.scene.remove(mesh);
        this.blocks = this.blocks.filter(b => b !== mesh);
        
        // Xóa block khỏi hệ thống map
        this.blockMap.delete(this.getKey(x, y, z));

        if (mesh.userData.type && !mesh.userData.type.isFluid) {
            this.spawnBreakParticles(mesh.position, mesh.userData.type);
        }
        if (mesh.userData.type && mesh.userData.type.id === BLOCK_TYPES.LAVA.id) {
            this.activeLavaBlocks = this.activeLavaBlocks.filter(b => b !== mesh);
        }

        // 2. Đánh thức các khối lân cận và GẮN CỜ KIỂM TRA RÚT NƯỚC
        const dirs = [{dx:1,dy:0,dz:0},{dx:-1,dy:0,dz:0},{dx:0,dy:1,dz:0},{dx:0,dy:-1,dz:0},{dx:0,dy:0,dz:1},{dx:0,dy:0,dz:-1}];
        dirs.forEach(d => {
            const nb = this.getBlock(x + d.dx, y + d.dy, z + d.dz);
            if (nb && nb.userData.type && nb.userData.type.isFluid) {
                if (!this.activeFluids.includes(nb)) this.activeFluids.push(nb);
                // QUAN TRỌNG: Ép game không được vứt bỏ khối này khỏi mảng cập nhật
                nb.userData.needsDecayCheck = true; 
            }
        });
    }

    // ==============================
    // PARTCILE/TEXTURE SUPPORT
    // ==============================

    async loadTextureImage(texturePath) {
        if (!texturePath) return null;
        if (this.textureImageCache.has(texturePath)) return this.textureImageCache.get(texturePath);
        try {
            const img = new Image(); img.crossOrigin = "anonymous";
            return new Promise((resolve) => {
                img.onload = () => { this.textureImageCache.set(texturePath, img); resolve(img); };
                img.onerror = () => resolve(null);
                img.src = texturePath;
            });
        } catch (e) { return null; }
    }

    createRandomCropTexture(textureImage, cropSize = 5) {
        const canvas = document.createElement("canvas"); canvas.width = cropSize; canvas.height = cropSize;
        const ctx = canvas.getContext("2d");
        if (!textureImage) { ctx.fillStyle = "#8b8b8b"; ctx.fillRect(0, 0, cropSize, cropSize); return new THREE.CanvasTexture(canvas); }
        const cropX = Math.random() * Math.max(0, textureImage.width - cropSize);
        const cropY = Math.random() * Math.max(0, textureImage.height - cropSize);
        ctx.drawImage(textureImage, cropX, cropY, cropSize, cropSize, 0, 0, cropSize, cropSize);
        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = tex.minFilter = THREE.NearestFilter;
        return tex;
    }

    async spawnBreakParticles(pos, blockType) {
        const texImg = await this.loadTextureImage(blockType.texture || (blockType.textures ? blockType.textures[0] : null));
        for (let i = 0; i < 16; i++) {
            const p = new THREE.Mesh(this.particleGeometries[Math.floor(Math.random()*4)],
                new THREE.MeshStandardMaterial({ map: this.createRandomCropTexture(texImg), transparent: true }));
            p.position.set(pos.x + (Math.random()-0.5)*0.6, pos.y + (Math.random()-0.5)*0.6, pos.z + (Math.random()-0.5)*0.6);
            p.velocity = new THREE.Vector3((Math.random()-0.5)*8, Math.random()*4+2, (Math.random()-0.5)*8);
            p.lifespan = 0.4 + Math.random() * 0.5;
            this.engine.scene.add(p); this.particles.push(p);
        }
    }

    // ==============================
    // UPDATE ALL: TÍNH PHYSICS, ANIMATION, CLOUDS
    // ==============================
    update(delta) {
        // 1. Particle hiệu ứng đập & lava
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.lifespan -= delta;
            if (p.lifespan <= 0) {
                this.engine.scene.remove(p);
                this.particles.splice(i, 1);
            } else {
                p.velocity.y -= 15 * delta;
                p.position.addScaledVector(p.velocity, delta);
                p.rotation.x += p.velocity.x * delta;
                p.rotation.y += p.velocity.y * delta;
            }
        }

        // Lava pop hiệu ứng
        if (this.activeLavaBlocks.length > 0) {
            this.lavaPopTimer += delta;
            if (this.lavaPopTimer >= 1.0) {
                this.lavaPopTimer = 0;
                const pops = Math.min(this.activeLavaBlocks.length, Math.floor(Math.random() * 2) + 1);
                for (let i = 0; i < pops; i++)
                    this.spawnLavaSpark(this.activeLavaBlocks[Math.floor(Math.random() * this.activeLavaBlocks.length)].position);
            }
        }

        // Mây trôi ngang
        if (this.cloudGroup && this.player && this.player.camera) {
            const px = this.player.camera.position.x, pz = this.player.camera.position.z, limit = 120;
            this.cloudGroup.children.forEach(c => {
                c.position.x -= 0.03;
                if (c.position.x < px - limit) c.position.x += limit * 2;
                if (c.position.z < pz - limit) c.position.z += limit * 2;
                else if (c.position.z > pz + limit) c.position.z -= limit * 2;
            });
        }
    }

    spawnLavaSpark(pos) {
        const size = 0.08 + Math.random() * 0.06;
        const p = new THREE.Mesh(
            new THREE.BoxGeometry(size, size, size),
            new THREE.MeshBasicMaterial({
                color: [0xff4400, 0xff6600, 0xffaa00][Math.floor(Math.random()*3)],
                transparent: true
            })
        );
        p.position.set(
            pos.x + (Math.random()-0.5)*0.8,
            pos.y + 0.5,
            pos.z + (Math.random()-0.5)*0.8
        );
        p.velocity = new THREE.Vector3(
            (Math.random()-0.5)*1.5,
            Math.random()*1.5 + 2.5,
            (Math.random()-0.5)*1.5
        );
        p.lifespan = p.maxLifespan = 0.4 + Math.random() * 0.6;
        p.isSpark = true;
        this.engine.scene.add(p); this.particles.push(p);
    }

    // ==============================
    // FLUIDS
    // ==============================
    tickFluids(delta) {
        this.updateFluidAnimations(delta);
        
        this.fluidTickTimer += delta;
        if (this.fluidTickTimer < 0.15) return;
        this.fluidTickTimer = 0;

        // -- CHẠY KIỂM TRA RÚT NƯỚC TRƯỚC --
        this.updateFluidDecay();

        const current = [...this.activeFluids];
        this.activeFluids = [];

        current.forEach(block => {
            const { x, y, z } = block.userData.gridPos;
            if (this.getBlock(x, y, z) !== block) return;

            const type = block.userData.type;
            const flow = block.userData.flowLevel;
            let keep = false;

            // Xử lý chảy rớt xuống dưới
            const below = this.getBlock(x, y - 1, z);
            if (!below || !below.userData.type.solid) {
                if (!below || below.userData.type.id !== type.id) { 
                    this.addBlock(x, y - 1, z, type, type.maxFlow, false); 
                    keep = true; 
                }
                this.activeFluids.push(block); 
                return;
            }

            // Xử lý chảy lan ra 4 hướng
            if (flow > 0) {
                [{dx:1,dz:0},{dx:-1,dz:0},{dx:0,dz:1},{dx:0,dz:-1}].forEach(d => {
                    const nb = this.getBlock(x + d.dx, y, z + d.dz);
                    if (!nb || !nb.userData.type.solid) {
                        if (!nb || nb.userData.flowLevel < flow - 1) { 
                            this.addBlock(x + d.dx, y, z + d.dz, type, flow - 1, false); 
                            keep = true; 
                        }
                    }
                });
            }
            
            // 3. GIẢI CỨU KHỐI NƯỚC: Nếu nó có cờ kiểm tra rút nước thì phải giữ nó lại!
            if (block.userData.isSource || keep || block.userData.needsDecayCheck) {
                this.activeFluids.push(block);
                block.userData.needsDecayCheck = false; // Đã sống sót qua 1 tick thì gỡ cờ đi
            }
        });
    }

    updateFluidAnimations(delta) {
        for (let i = this.animatingFluids.length - 1; i >= 0; i--) {
            const b = this.animatingFluids[i];
            if (!this.blocks.includes(b)) { this.animatingFluids.splice(i, 1); continue; }
            const h = b.scale.y, target = b.userData.targetHeight;
            if (h < target) {
                const newH = Math.min(target, h + delta * 3);
                b.scale.set(1, newH, 1);
                b.position.y = b.userData.gridPos.y - (1 - newH) / 2;
                if (newH >= target) this.animatingFluids.splice(i, 1);
            }
        }
    }

    // ==========================================
    // CƠ CHẾ NƯỚC/LAVA TỰ RÚT CẠN (FLUID DECAY)
    // ==========================================
    updateFluidDecay() {
        for (let i = this.activeFluids.length - 1; i >= 0; i--) {
            const block = this.activeFluids[i];
            if (!block || !block.parent) {
                this.activeFluids.splice(i, 1);
                continue;
            }
            
            // Nguồn (Source) thì không bao giờ tự khô
            if (block.userData.isSource) continue;

            const x = Math.round(block.position.x);
            const y = Math.round(block.position.y);
            const z = Math.round(block.position.z);
            const fluidId = block.userData.type.id;
            const myFlow = block.userData.flowLevel;

            let hasSupport = false;

            // ĐK 1: Có thác nước rớt thẳng từ trên đỉnh đầu xuống
            const above = this.getBlock(x, y + 1, z);
            if (above && above.userData.type.id === fluidId) {
                hasSupport = true;
            } else {
                // ĐK 2: Có dòng chảy mạnh hơn (hoặc Nguồn) ở 1 trong 4 hướng xung quanh
                const dirs = [ {dx:1,dz:0}, {dx:-1,dz:0}, {dx:0,dz:1}, {dx:0,dz:-1} ];
                for (let d of dirs) {
                    const nb = this.getBlock(x + d.dx, y, z + d.dz);
                    if (nb && nb.userData.type.id === fluidId) {
                        // Nếu đứng cạnh khối có flowLevel CAO HƠN -> Tức là nó đang được truyền nước
                        if (nb.userData.isSource || nb.userData.flowLevel > myFlow) {
                            hasSupport = true;
                            break;
                        }
                    }
                }
            }

            // Nếu không có ai chống lưng -> Rút cạn nước!
            if (!hasSupport) {
                this.removeBlock(block); // Hàm này sẽ tự đánh thức các ô tiếp theo để chúng rút theo dây chuyền
                this.activeFluids.splice(i, 1);
            }
        }
    }

    clearWaterNetwork(sx, sy, sz, fluidId) {
        sx = Math.round(sx); sy = Math.round(sy); sz = Math.round(sz);
        
        const queue = [{ x: sx, y: sy, z: sz, dist: 0 }];
        const visited = new Set();
        visited.add(`${sx},${sy},${sz}`);
        
        while (queue.length > 0) {
            const { x, y, z, dist } = queue.shift();
            const block = this.getBlock(x, y, z);
            
            if (block && block.userData.type.id === fluidId) {
                
                // --- CHẶN ĐỨNG SỰ LAN TRÀN (SỬA LỖI ĐỂ LẠI VŨNG NƯỚC) ---
                // 1. Trục xuất khối nước này khỏi danh sách update để nó không chảy tiếp được nữa
                const activeIdx = this.activeFluids.indexOf(block);
                if (activeIdx > -1) {
                    this.activeFluids.splice(activeIdx, 1);
                }
                
                // 2. Ép nó thành nước chết
                block.userData.flowLevel = 0; 
                block.userData.isSource = false;

                // --- SAU ĐÓ MỚI HẸN GIỜ XÓA TỪ TỪ ---
                setTimeout(() => {
                    if (this.getBlock(x, y, z) === block) {
                        this.removeBlock(block);
                    }
                }, dist * 480); 
                
                // Quét 6 hướng để lan tỏa hiệu ứng rút nước
                const directions = [
                    {dx: 1, dy: 0, dz: 0}, {dx: -1, dy: 0, dz: 0},
                    {dx: 0, dy: -1, dz: 0}, {dx: 0, dy: 1, dz: 0}, 
                    {dx: 0, dy: 0, dz: 1}, {dx: 0, dy: 0, dz: -1}
                ];
                
                for (let dir of directions) {
                    const nx = x + dir.dx;
                    const ny = y + dir.dy;
                    const nz = z + dir.dz;
                    const key = `${nx},${ny},${nz}`;
                    
                    if (!visited.has(key)) {
                        visited.add(key);
                        
                        const neighbor = this.getBlock(nx, ny, nz);
                        if (neighbor && neighbor.userData.type.id === fluidId) {
                            queue.push({ x: nx, y: ny, z: nz, dist: dist + 1 });
                        }
                    }
                }
            }
        }
    }

}