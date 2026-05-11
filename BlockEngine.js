// BlockEngine.js
// Quản lý các tính năng của 1 Block, vd như tạo Texture cho Block

import * as THREE from 'three';
import { BLOCK_TYPES } from './blocks.js';

export class BlockEngine {
    constructor(scene) {
        this.scene = scene;
        this.cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
        this.planeGeometry = new THREE.PlaneGeometry(1, 1); // Dùng cho cây cỏ
        this.textureLoader = new THREE.TextureLoader();

        // MỚI: Danh sách chứa vật liệu chất lỏng để làm animation
        this.fluidMaterials = [];
    }

    loadPixelTexture(url) {
        const texture = this.textureLoader.load(url);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace; 

        // MỚI: Bắt buộc phải có 2 dòng này thì ảnh mới cuộn tròn liên tục được
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        return texture;
    }

    createBlock(x, y, z, type = BLOCK_TYPES.GRASS) {
        let object3D; 

        // XỬ LÝ RIÊNG CHO CÂY CỎ (SEA_GRASS, v.v.)
        if (type.isPlant) {
            const material = new THREE.MeshStandardMaterial({
                map: this.loadPixelTexture(type.texture),
                transparent: true,
                alphaTest: 0.5,
                side: THREE.DoubleSide
            });

            object3D = new THREE.Group(); 
            // Tạo 2 mặt phẳng bắt chéo hình chữ X
            const plane1 = new THREE.Mesh(this.planeGeometry, material);
            plane1.rotation.y = Math.PI / 4; 
            const plane2 = new THREE.Mesh(this.planeGeometry, material);
            plane2.rotation.y = -Math.PI / 4; 

            object3D.add(plane1);
            object3D.add(plane2);

            plane1.castShadow = true;
            plane1.receiveShadow = true;

            plane2.castShadow = true;
            plane2.receiveShadow = true;
        } 
        else if (type.isFluid) {
            // MỚI: XỬ LÝ CHẤT LỎNG
            const materialConfig = {
                map: this.loadPixelTexture(type.texture),
                transparent: type.transparent || false,
                opacity: type.opacity || 1,
            };
            if (type.emissive) {
                materialConfig.emissive = new THREE.Color(type.emissive);
                materialConfig.emissiveIntensity = type.intensity || 1;
            }

            const material = new THREE.MeshStandardMaterial(materialConfig);
            object3D = new THREE.Mesh(this.cubeGeometry, material);
            
            // Lưu material này lại để tí nữa bắt nó chuyển động
            this.fluidMaterials.push(material);
        }
        // XỬ LÝ KHỐI LẬP PHƯƠNG BÌNH THƯỜNG
        else {
            let materials;
            const materialConfig = {
                color: type.color || 0xffffff,
                transparent: type.transparent || false,
                opacity: type.opacity || 1,
            };

            // Ưu tiên hiển thị texture nếu có
            if (type.textures) { // Cho khối nhiều mặt như Grass
                materials = type.textures.map(url => new THREE.MeshStandardMaterial({
                    ...materialConfig, map: this.loadPixelTexture(url)
                }));
            } else if (type.texture) { // Cho khối 1 mặt như Dirt, Stone
                materialConfig.map = this.loadPixelTexture(type.texture);
                materials = new THREE.MeshStandardMaterial(materialConfig);
            } else {
                materials = new THREE.MeshStandardMaterial(materialConfig);
            }

            object3D = new THREE.Mesh(this.cubeGeometry, materials);
            object3D.castShadow = true;
            object3D.receiveShadow = true;
        }

        object3D.position.set(x, y, z);
        object3D.userData.type = type; // Cực kỳ quan trọng để kiểm tra va chạm

        this.scene.add(object3D);
        return object3D;
    }
    // MỚI: Hàm này sẽ được gọi liên tục mỗi khung hình (60 FPS)
    updateFluids(delta) {
        this.fluidMaterials.forEach(mat => {
            if (mat.map) {
                // Trừ dần trục Y để tạo cảm giác nước chảy từ trên xuống
                // Chỉnh số 0.5 to lên nếu muốn chảy nhanh hơn
                mat.map.offset.y -= 0.5 * delta; 
            }
        });
    }
}