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
        this.spawnBreakParticles(mesh.position, blockMaterial);
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

    addBlock(x, y, z, type) {
        const newBlock = this.engine.createBlock(x, y, z, type);
        this.blocks.push(newBlock);
        
        const key = this.getKey(x, y, z);
        this.blockMap.set(key, newBlock);
        return newBlock;
    }

    // --- HÀM XỬ LÝ RƠI CỦA MẢNH VỤN ---
    update(delta) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.lifespan -= delta;

            if (p.lifespan <= 0) {
                // Hết thời gian sống -> Xóa khỏi game
                this.engine.scene.remove(p);
                this.particles.splice(i, 1);
            } else {
                // Áp dụng trọng lực kéo xuống (-15)
                p.velocity.y -= 15.0 * delta; 
                
                // Cập nhật vị trí dựa trên vận tốc
                p.position.addScaledVector(p.velocity, delta);
                
                // Xoay mảnh vụn cho đẹp mắt
                p.rotation.x += p.velocity.x * delta;
                p.rotation.y += p.velocity.y * delta;
            }
        }
    }
}