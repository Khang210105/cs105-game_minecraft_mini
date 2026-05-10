// Tạo 1 bản đồ là khối x có kích thước NxN
// Đặt và phá block

// World.js
import * as THREE from 'three';
import { BLOCK_TYPES } from './blocks.js';

export class World {
    constructor(blockEngine) {
        this.engine = blockEngine;
        this.blocks = [];
        this.blockMap = new Map(); // Bộ nhớ siêu tốc để check va chạm
        
        // --- HIỆU ỨNG VỠ ---
        this.particles = []; // Mảng chứa các mảnh vụn đang bay
        this.particleGeometry = new THREE.BoxGeometry(0.25, 0.25, 0.25); // Kích thước mảnh vụn (bằng 1/4 block)

        // --- MỚI: HỆ THỐNG CHẤT LỎNG ---
        this.activeFluids = []; // Chứa các khối nước đang chảy
        this.fluidTickTimer = 0; // Bộ đếm thời gian

        this.animatingFluids = []; // --- MỚI: Danh sách khối nước đang dâng lên ---
        // --- MỚI: Mảng lưu trữ tàn lửa/khói ---
        this.particles = [];
        this.activeLavaBlocks = [];

        // --- MỚI: Đồng hồ đếm thời gian nổ bong bóng ---
        this.lavaPopTimer = 0;
    }

    // Hàm tạo tàn lửa bay lên từ Lava
    spawnLavaSpark(pos) {
        // Kích thước to hơn chút để trông giống giọt dung nham
        const size = 0.08 + Math.random() * 0.06; 
        const geometry = new THREE.BoxGeometry(size, size, size);
        
        // Chỉ dùng các tông màu rực của dung nham (Cam, Cam Đỏ, Vàng Cam)
        const colors = [0xff4400, 0xff6600, 0xffaa00];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        const material = new THREE.MeshBasicMaterial({ color: color, transparent: true });
        const particle = new THREE.Mesh(geometry, material);

        particle.position.set(
            pos.x + (Math.random() - 0.5) * 0.8,
            pos.y + 0.5, // Nằm ngay sát mặt dung nham
            pos.z + (Math.random() - 0.5) * 0.8
        );

        // Vận tốc: Bắn "bụp" thẳng lên trời, hơi dạt ra xung quanh một chút
        particle.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 1.5, // Dạt X
            Math.random() * 1.5 + 2.5,   // Bật mạnh lên Y
            (Math.random() - 0.5) * 1.5  // Dạt Z
        );

        // Thời gian sống cực ngắn (0.3 đến 0.6 giây) để cảm giác nổ chớp nhoáng
        particle.lifespan = 0.3 + Math.random() * 0.9;     
        particle.maxLifespan = particle.lifespan;  
        particle.isSpark = true;     

        this.engine.scene.add(particle); 
        this.particles.push(particle);
    }

    getKey(x, y, z) {
        return `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
    }

    getBlock(x, y, z) {
        return this.blockMap.get(this.getKey(x, y, z));
    }

    generate(size = 50) {
        const half = Math.floor(size / 2);
        for (let x = -half; x < half; x++) {
            for (let z = -half; z < half; z++) {
                this.addBlock(x, 0, z, BLOCK_TYPES.GRASS);
            }
        }
    }

    removeBlock(mesh) {
        // 1. Tìm chất liệu (màu/ảnh) của block đang đập để gán cho mảnh vụn
        let blockMaterial;
        if (mesh.type === 'Group') {
            blockMaterial = mesh.children[0].material; // Nếu là cây (Group), lấy màu của lá
        } else {
            blockMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material; 
        }

        // 2. Xóa block như cũ
        this.engine.scene.remove(mesh);
        this.blocks = this.blocks.filter(b => b !== mesh);
        const key = this.getKey(mesh.position.x, mesh.position.y, mesh.position.z);
        this.blockMap.delete(key);

        // 3. Gọi hàm phun mảnh vụn
        // --- MỚI: CHỈ TẠO HẠT VỠ NẾU KHÔNG PHẢI LÀ CHẤT LỎNG ---
        if (!mesh.userData.type.isFluid) {
            this.spawnBreakParticles(mesh.position, blockMaterial);
        }   
        // --- MỚI: HỦY ĐĂNG KÝ NẾU ĐÓ LÀ LAVA ---
        if (mesh.userData && mesh.userData.type.id === BLOCK_TYPES.LAVA.id) {
            this.activeLavaBlocks = this.activeLavaBlocks.filter(b => b !== mesh);
        }
    }

    spawnBreakParticles(pos, material) {
        // Tạo ra 8 mảnh vụn văng ra xung quanh
        for (let i = 0; i < 16; i++) {
            const particle = new THREE.Mesh(this.particleGeometry, material);
            
            // Vị trí ban đầu: Nằm ngẫu nhiên bên trong vị trí block vừa vỡ
            particle.position.set(
                pos.x + (Math.random() - 0.5) * 0.5,
                pos.y + (Math.random() - 0.5) * 0.5,
                pos.z + (Math.random() - 0.5) * 0.5
            );

            // Vận tốc văng ngẫu nhiên (vx, vy, vz)
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 6, // Trục X
                Math.random() * 3 + 2,     // Trục Y (Nhảy lên trên)
                (Math.random() - 0.5) * 6  // Trục Z
            );

            // Thời gian sống của mảnh vỡ (0.2 -> 0.5 giây)
            particle.lifespan = 0.2 + Math.random() * 0.3;

            this.engine.scene.add(particle);
            this.particles.push(particle);
        }
    }

    // Cập nhật hàm addBlock để gán Flow Level và đưa vào mảng Active Fluids
    addBlock(x, y, z, type, flowLevel = null, isSource = false) {
        x = Math.round(x);
        y = Math.round(y);
        z = Math.round(z);

        const existingBlock = this.getBlock(x, y, z);
        if (existingBlock) {
            if (existingBlock.userData.type.solid) return null; 
            this.removeBlock(existingBlock); 
        }

        const newBlock = this.engine.createBlock(x, y, z, type);
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

            // 1. KIỂM TRA KHỐI Ở TRÊN ĐẦU
            const blockAbove = this.getBlock(x, y + 1, z);
            if (blockAbove && blockAbove.userData.type.isFluid) {
                // Bị chất lỏng khác đè lên -> Phình to 1.0 để nối liền mạch cột nước
                newBlock.userData.targetHeight = 1.0;
                newBlock.scale.set(1, 1.0, 1);
                newBlock.position.y = y; // Giữ nguyên tọa độ chuẩn
            } else {
                // Không bị đè -> Là bề mặt, lùn xuống một chút và dâng lên từ từ
                if (newBlock.userData.isSource) {
                    newBlock.scale.set(1, targetHeight, 1);
                    newBlock.position.y = y - (1 - targetHeight) / 2;
                } else {
                    newBlock.scale.set(1, 0.01, 1);
                    newBlock.position.y = y - (1 - 0.01) / 2;
                    this.animatingFluids.push(newBlock);
                }
            }

            // 2. KIỂM TRA KHỐI Ở DƯỚI ĐÁY
            // Nếu có chất lỏng ở dưới, thì chất lỏng đó không còn là "bề mặt" nữa -> Phải phình to lên
            const blockBelow = this.getBlock(x, y - 1, z);
            if (blockBelow && blockBelow.userData.type.isFluid) {
                blockBelow.userData.targetHeight = 1.0;
                blockBelow.scale.set(1, 1.0, 1);
                blockBelow.position.y = y - 1; 
                
                // Nếu cục dưới đang nằm trong hàng chờ dâng lên, thì cho nó hoàn thành luôn để khỏi bị lỗi
                const animIndex = this.animatingFluids.indexOf(blockBelow);
                if (animIndex > -1) {
                    this.animatingFluids.splice(animIndex, 1);
                }
            }

            this.activeFluids.push(newBlock); 
        }

        // --- ĐĂNG KÝ VÀO DANH SÁCH LAVA MỖI KHI CÓ LAVA ĐƯỢC TẠO RA ---
        if (type.id === BLOCK_TYPES.LAVA.id) {
            this.activeLavaBlocks.push(newBlock);
        }

        return newBlock;
    }

    // --- HÀM CẬP NHẬT CHÍNH MỖI KHUNG HÌNH ---
    update(delta) {
        // 1. XỬ LÝ CHUYỂN ĐỘNG CỦA TẤT CẢ CÁC HẠT (Mảnh vỡ block + Tàn lửa Lava)
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.lifespan -= delta;

            if (p.lifespan <= 0) {
                // Hết thời gian sống -> Xóa khỏi game
                this.engine.scene.remove(p);
                // Dọn rác bộ nhớ
                if (p.geometry) p.geometry.dispose();
                if (p.material) p.material.dispose();
                this.particles.splice(i, 1);
            } else {
                // --- PHÂN LOẠI HẠT ---
                if (p.isSpark) {
                    // [A] DÀNH CHO BONG BÓNG LAVA "NỔ LÙM BÙM"
                    // Thêm trọng lực nhẹ để hạt văng lên rồi rớt xuống đường cong
                    p.velocity.y -= 12.0 * delta; 
                    p.position.addScaledVector(p.velocity, delta);
                    
                    // Vẫn giữ hiệu ứng thu nhỏ và mờ dần khi chìm lại vào dung nham
                    const scale = Math.max(0, p.lifespan / p.maxLifespan);
                    p.scale.set(scale, scale, scale);
                    if (p.material) p.material.opacity = scale;

                } else {
                    // [B] DÀNH CHO MẢNH VỠ BLOCK (Đập đá, đất...)
                    p.velocity.y -= 15.0 * delta; // Trọng lực nặng hơn
                    p.position.addScaledVector(p.velocity, delta);
                    
                    p.rotation.x += p.velocity.x * delta;
                    p.rotation.y += p.velocity.y * delta;
                }
            }
        }

        // 2. --- CƠ CHẾ ĐẾM GIÂY ĐỂ NỔ LÙM BÙM ---
        if (this.activeLavaBlocks.length > 0) {
            // Cộng dồn thời gian mỗi khung hình
            this.lavaPopTimer += delta;
            
            // Cứ đủ 1 giây (1.0) thì cho nổ
            if (this.lavaPopTimer >= 1.0) {
                // Reset đồng hồ về 0 để đếm lại từ đầu
                this.lavaPopTimer = 0; 

                // Chọn ngẫu nhiên số lượng ô lava sẽ nổ (Ví dụ: 1 đến 3 ô nổ cùng lúc)
                // Nếu map có quá ít lava (nhỏ hơn 3) thì lấy giới hạn bằng số lượng lava hiện có
                const numPops = Math.min(this.activeLavaBlocks.length, Math.floor(Math.random() * 3) + 1);
                
                for (let i = 0; i < numPops; i++) {
                    // Bốc ngẫu nhiên 1 ô lava trong danh sách (kể cả ô gốc lẫn ô chảy lan)
                    const randomIndex = Math.floor(Math.random() * this.activeLavaBlocks.length);
                    const randomLavaBlock = this.activeLavaBlocks[randomIndex];
                    
                    // Gọi hàm bắn bong bóng tại tọa độ của ô đó
                    this.spawnLavaSpark(randomLavaBlock.position);
                }
            }
        }
    }

    // --- HÀM MỚI: Tạo độ mượt khi nước lan ---
    updateFluidAnimations(delta) {
        for (let i = this.animatingFluids.length - 1; i >= 0; i--) {
            const block = this.animatingFluids[i];
            
            if (!this.blocks.includes(block)) {
                this.animatingFluids.splice(i, 1);
                continue;
            }
            
            const currentHeight = block.scale.y;
            const targetHeight = block.userData.targetHeight;
            
            if (currentHeight < targetHeight) {
                let newHeight = currentHeight + delta * 4; 
                if (newHeight >= targetHeight) {
                    newHeight = targetHeight;
                    this.animatingFluids.splice(i, 1); 
                }
                
                block.scale.set(1, newHeight, 1);
                // Dùng tọa độ chuẩn gridPos.y để không bao giờ bị trôi
                block.position.y = block.userData.gridPos.y - (1 - newHeight) / 2;
            }
        }
    }

    // --- THUẬT TOÁN LOANG (FLOOD FILL) ---
    tickFluids(delta) {
        // Chạy hiệu ứng mượt mỗi khung hình (không phụ thuộc vào nhịp tick)
        this.updateFluidAnimations(delta);

        this.fluidTickTimer += delta;
        if (this.fluidTickTimer < 0.15) return; // Tôi giảm xuống 0.15 cho nước chảy nhanh hơn tí xíu
        this.fluidTickTimer = 0;

        const currentFluids = [...this.activeFluids];
        this.activeFluids = []; 

        for (let i = 0; i < currentFluids.length; i++) {
            const block = currentFluids[i];
            const { x, y, z } = block.userData.gridPos;

            if (this.getBlock(x, y, z) !== block) continue;

            const type = block.userData.type;
            const flowLevel = block.userData.flowLevel;
            let keepActive = false; // --- MỚI: Biến quyết định xem block này có ngủ hay không ---

            // 1. ƯU TIÊN CHẢY XUỐNG DƯỚI
            const blockBelow = this.getBlock(x, y - 1, z);
            if (!blockBelow || !blockBelow.userData.type.solid) {
                if (!blockBelow || (blockBelow.userData.type.id !== type.id)) {
                    this.addBlock(x, y - 1, z, type, type.maxFlow, false); 
                    keepActive = true; 
                }
                this.activeFluids.push(block); // Rơi thì luôn thức để dò đáy
                continue; 
            }

            // 2. CHẢY SANG NGANG NẾU BÊN DƯỚI LÀ MẶT ĐẤT
            if (flowLevel > 0) {
                const directions = [
                    { dx: 1, dz: 0 }, { dx: -1, dz: 0 },
                    { dx: 0, dz: 1 }, { dx: 0, dz: -1 }
                ];

                for (const dir of directions) {
                    const nx = x + dir.dx;
                    const nz = z + dir.dz;
                    const neighbor = this.getBlock(nx, y, nz);

                    if (!neighbor || !neighbor.userData.type.solid) {
                        if (!neighbor || neighbor.userData.flowLevel < flowLevel - 1) {
                            this.addBlock(nx, y, nz, type, flowLevel - 1, false);
                            keepActive = true; // Thành công lan ra ô mới -> Giữ bản thân thức để bơm tiếp
                        }
                    }
                }
            }

            // --- QUAN TRỌNG: Nước gốc (Source) luôn thức. Nước chảy (Flow) chỉ ngủ khi đã cạn hoặc kẹt ---
            if (block.userData.isSource || keepActive) {
                this.activeFluids.push(block);
            }
        }
    }

    // Thêm hàm này vào class World (World.js)
    clearWaterNetwork(sx, sy, sz, fluidId) {
        sx = Math.round(sx); sy = Math.round(sy); sz = Math.round(sz);
        const queue = [{ x: sx, y: sy, z: sz }];
        
        while (queue.length > 0) {
            const { x, y, z } = queue.shift();
            const block = this.getBlock(x, y, z);
            
            if (block && block.userData.type.id === fluidId) {
                this.removeBlock(block);
                
                // --- MỚI: Quét cả 6 hướng ---
                const directions = [
                    {dx: 1, dy: 0, dz: 0}, {dx: -1, dy: 0, dz: 0},
                    {dx: 0, dy: -1, dz: 0}, {dx: 0, dy: 1, dz: 0}, 
                    {dx: 0, dy: 0, dz: 1}, {dx: 0, dy: 0, dz: -1}
                ];
                
                for (let dir of directions) {
                    const nx = x + dir.dx;
                    const ny = y + dir.dy;
                    const nz = z + dir.dz;
                    const neighbor = this.getBlock(nx, ny, nz);
                    
                    // --- MỚI: Xóa toàn bộ nước xung quanh, MIỄN LÀ NÓ KHÔNG PHẢI NƯỚC GỐC KHÁC ---
                    if (neighbor && neighbor.userData.type.id === fluidId) {
                        if (!neighbor.userData.isSource) {
                            queue.push({ x: nx, y: ny, z: nz });
                        }
                    }
                }
            }
        }
    }
}