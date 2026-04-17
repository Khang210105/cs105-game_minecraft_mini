// File này quản lý Raycaster (tia laser phát ra từ camera) để tính toán va chạm và gọi hàm xóa/thêm từ World.

// Interaction.js
import * as THREE from 'three';
import { BLOCK_TYPES } from './blocks.js';

export class Interaction {
    constructor(player, world, scene, inventory) {
        this.player = player;
        this.world = world;
        this.scene = scene;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2(0, 0); // Tâm màn hình
        this.limit = 3.6;
        this.inventory = inventory;

        // --- Tạo viền khi chọn ô (Highlight) ---
        const geometry = new THREE.BoxGeometry(1.01, 1.01, 1.01); // Lớn hơn 1 chút để không bị đè hình
        const edges = new THREE.EdgesGeometry(geometry);
        this.selectionBox = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }));
        this.selectionBox.visible = false;
        this.scene.add(this.selectionBox);

        this.initEventListeners();
    }

    initEventListeners() {
        window.addEventListener('mousedown', (e) => {
            if (!this.player.controls.isLocked) return;

            this.raycaster.setFromCamera(this.mouse, this.player.camera);
            // THÊM 'true' VÀO ĐÂY ĐỂ QUÉT XUYÊN VÀO GROUP
            const intersects = this.raycaster.intersectObjects(this.world.blocks, true); 

            if (intersects.length > 0) {
                const intersect = intersects[0];
                let targetBlock = intersect.object;

                // TÌM VỀ BLOCK CHA NẾU TRÚNG MẶT PHẲNG LÁ CỦA CÂY
                if (targetBlock.parent && targetBlock.parent.type === 'Group') {
                    targetBlock = targetBlock.parent;
                }

                if (intersect.distance <= this.limit) {
                    if (e.button === 0) {
                        this.world.removeBlock(targetBlock); // Dùng targetBlock
                    } else if (e.button === 2) {
                        const pos = targetBlock.position.clone().add(intersect.face.normal); // Dùng targetBlock
                        
                        if (!this.player.intersectsBlock(pos.x, pos.y, pos.z)) {
                            const currentBlockType = this.inventory.getCurrentBlock();
                            if (currentBlockType) {
                                this.world.addBlock(pos.x, pos.y, pos.z, currentBlockType);
                            }
                        }
                    }
                }
            }
        });
        window.addEventListener('contextmenu', e => e.preventDefault());
    }

    update() {
        if (!this.player.controls.isLocked) {
            this.selectionBox.visible = false;
            return;
        }

        this.raycaster.setFromCamera(this.mouse, this.player.camera);
        // THÊM 'true' VÀO ĐÂY NỮA (Để khung viền đen hiển thị đúng ở cây)
        const intersects = this.raycaster.intersectObjects(this.world.blocks, true);

        if (intersects.length > 0 && intersects[0].distance <= this.limit) {
            let target = intersects[0].object;
            
            // XỬ LÝ TƯƠNG TỰ CHO KHUNG VIỀN ĐEN
            if (target.parent && target.parent.type === 'Group') {
                target = target.parent;
            }

            this.selectionBox.position.copy(target.position);
            this.selectionBox.visible = true;
        } else {
            this.selectionBox.visible = false;
        }
    }
}