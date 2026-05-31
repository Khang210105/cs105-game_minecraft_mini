// Interaction.js
import * as THREE from 'three';
import { BLOCK_TYPES } from './blocks.js';

export class Interaction {
    constructor(player, world, scene, inventory) {
        this.player = player;
        this.world = world;
        this.scene = scene;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2(0, 0); 
        this.limit = 4.5; // Kéo dài tầm với ra một chút để dễ đào dưới nước
        this.inventory = inventory;
        this.selectionRaycastIntervalMs = 66; // 15hz
        this.lastSelectionRaycastAt = 0;
        this.cachedTargetBlock = null;

        const geometry = new THREE.BoxGeometry(1.01, 1.01, 1.01); 
        const edges = new THREE.EdgesGeometry(geometry);
        this.selectionBox = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }));
        this.selectionBox.visible = false;
        this.scene.add(this.selectionBox);

        this.initEventListeners();
    }

    // --- MỚI: HÀM LỌC CHẤT LỎNG ---
    getValidTarget(intersects) {
        const currentItem = this.inventory.getCurrentBlock();

        for (let i = 0; i < intersects.length; i++) {
            let target = intersects[i].object;
            if (target.parent && target.parent.type === 'Group') target = target.parent;
            
            // Nếu đang cầm xô trống -> Cho phép nhắm trúng chất lỏng
            if (currentItem && currentItem.isBucket && currentItem.isEmpty) {
                if (target.userData.type.isFluid) return { intersect: intersects[i], block: target };
            }
            
            // Bình thường: Xuyên qua chất lỏng
            if (!target.userData.type.isFluid) {
                return { intersect: intersects[i], block: target };
            }
        }
        return null; 
    }

    initEventListeners() {
        window.addEventListener('mousedown', (e) => {
            if (!this.player.controls.isLocked) return;

            this.raycaster.setFromCamera(this.mouse, this.player.camera);
            // THÊM true ĐỂ TIA NHÌN QUÉT TRÚNG LÁ CÂY/CỎ
            const intersects = this.raycaster.intersectObjects(this.world.blocks, true); 
            
            if (intersects.length === 0) return;

            const currentItem = this.inventory.getCurrentBlock();
            
            // --- HÀM GIẢI MÃ GROUP (Biến mảnh lá thành cụm cỏ) ---
            const getResolvedObject = (intersect) => {
                let obj = intersect.object;
                if (obj.parent && obj.parent.type === 'Group') {
                    return obj.parent;
                }
                return obj;
            };
            
            let targetHit = null;
            
            // 1. Tìm khối chất lỏng (Check an toàn 3 lớp)
            const firstFluid = intersects.find(i => {
                const obj = getResolvedObject(i);
                return obj.userData && obj.userData.type && obj.userData.type.isFluid === true;
            });

            // 2. Tìm khối cứng hoặc cỏ (Check an toàn 3 lớp)
            const firstSolid = intersects.find(i => {
                const obj = getResolvedObject(i);
                return !(obj.userData && obj.userData.type && obj.userData.type.isFluid === true);
            });

            // Ưu tiên múc nước nếu cầm xô
            if (currentItem && currentItem.isBucket && firstFluid) {
                if (!firstSolid || firstFluid.distance < firstSolid.distance) {
                    targetHit = { intersect: firstFluid, block: getResolvedObject(firstFluid) };
                }
            }

            // Nếu không, tương tác với khối cứng/cỏ biển
            if (!targetHit && firstSolid) {
                targetHit = { intersect: firstSolid, block: getResolvedObject(firstSolid) };
            }

            if (targetHit && targetHit.intersect.distance <= this.limit) {
                let targetBlock = targetHit.block; // Chắc chắn là cụm cỏ gốc (0,0,0 của cỏ, không phải lá)

                const isFluid = targetBlock.userData && targetBlock.userData.type && targetBlock.userData.type.isFluid;

                if (e.button === 0) { // Chuột trái: Đập block
                    if (!isFluid) {
                        this.world.removeBlock(targetBlock);
                    }
                } else if (e.button === 2) { // Chuột phải: Đặt block / Múc nước
                    // Tính vị trí đặt block dựa trên block gốc
                    const pos = targetBlock.position.clone().add(targetHit.intersect.face.normal);
                    
                    if (currentItem && currentItem.isBucket) {
                        if (currentItem.isEmpty && isFluid) {
                            if (targetBlock.userData.isSource) {
                                this.world.clearWaterNetwork(
                                    targetBlock.userData.gridPos.x, 
                                    targetBlock.userData.gridPos.y, 
                                    targetBlock.userData.gridPos.z, 
                                    targetBlock.userData.type.id
                                );
                                const bucketType = targetBlock.userData.type.id === BLOCK_TYPES.LAVA.id ? 
                                                   BLOCK_TYPES.BUCKET_LAVA : BLOCK_TYPES.BUCKET_WATER;
                                // this.inventory.slots[this.inventory.activeSlotIndex] = bucketType;
                                // this.inventory.renderHotbar();
                            }
                        } 
                        else if (!currentItem.isEmpty) {
                            let fluidToPour = currentItem.id === BLOCK_TYPES.BUCKET_LAVA.id ? 
                                              BLOCK_TYPES.LAVA : BLOCK_TYPES.WATER;
                            this.world.addBlock(pos.x, pos.y, pos.z, fluidToPour);
                            // this.inventory.slots[this.inventory.activeSlotIndex] = BLOCK_TYPES.BUCKET_EMPTY;
                            // this.inventory.renderHotbar();
                        }
                        // ĐỔ NƯỚC/LAVA:
                        else if (!currentItem.isEmpty) {
                            let fluidToPour = currentItem.id === BLOCK_TYPES.BUCKET_LAVA.id ? 
                                              BLOCK_TYPES.LAVA : BLOCK_TYPES.WATER;
                                              
                            this.world.addBlock(pos.x, pos.y, pos.z, fluidToPour);
                            
                            // ĐÃ ĐỔI LẠI: BUCKET_EMPTY
                            // this.inventory.slots[this.inventory.activeSlotIndex] = BLOCK_TYPES.BUCKET_EMPTY;
                            // this.inventory.renderHotbar();
                        }
                        return; 
                    }
                    
                    if (!this.player.intersectsBlock(pos.x, pos.y, pos.z)) {
                        if (currentItem && !currentItem.isBucket) {
                            this.world.addBlock(pos.x, pos.y, pos.z, currentItem);
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
            this.cachedTargetBlock = null;
            return;
        }

        const now = performance.now();
        const shouldRaycast = (now - this.lastSelectionRaycastAt) >= this.selectionRaycastIntervalMs;

        if (shouldRaycast) {
            this.lastSelectionRaycastAt = now;
            this.raycaster.setFromCamera(this.mouse, this.player.camera);
            const intersects = this.raycaster.intersectObjects(this.world.blocks, true);

            let targetIntersect = null;
            let targetBlock = null;

            for (let i = 0; i < intersects.length; i++) {
                let obj = intersects[i].object;
                
                // Giải mã Group cho viền đen
                if (obj.parent && obj.parent.type === 'Group') {
                    obj = obj.parent;
                }

                // Check an toàn 3 lớp
                const isFluid = obj.userData && obj.userData.type && obj.userData.type.isFluid === true;
                
                if (!isFluid) {
                    targetIntersect = intersects[i]; 
                    targetBlock = obj; 
                    break;
                }
            }

            if (targetIntersect && targetIntersect.distance <= this.limit) {
                this.cachedTargetBlock = targetBlock;
            } else {
                this.cachedTargetBlock = null;
            }
        }

        if (this.cachedTargetBlock) {
            this.selectionBox.position.copy(this.cachedTargetBlock.position); 
            this.selectionBox.visible = true;
        } else {
            this.selectionBox.visible = false;
        }
    }
}
