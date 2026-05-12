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

        // MỚI: Danh sách các vật liệu chất lỏng cần làm animation khung hình
        this.animatedFluidMaterials = [];
        // MỚI: Bộ đếm thời gian nội bộ
        this.internalTime = 0;
        // MỚI: Tốc độ animation (khung hình/giây - ví dụ: 12 fps)
        this.FLUID_ANIMATION_FPS = 6;

        this.fluidMaterials = [];
    }

    loadPixelTexture(url) {
        const texture = this.textureLoader.load(url, (tex) => {
            // Nếu phát hiện ảnh có chiều cao lớn hơn chiều rộng (dải sprite sheet dài)
            if (tex.image && tex.image.height > tex.image.width) {
                // 1. Tính toán số khung hình (ví dụ: 256/16 = 16 frames)
                const frames = tex.image.height / tex.image.width;
                // 2. Tính tỷ lệ cao độ của 1 khung hình so với cả dải ảnh
                const frameRatio = 1 / frames;
                
                // 3. Chỉ lặp lại texture 1 khung hình dọc
                tex.repeat.set(1, frameRatio);
                
                // 4. Lưu thông số vào texture để dùng lúc animation
                tex.userData.animationMetadata = { frames, frameRatio };
            }
        });

        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace; 

        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        return texture;
    }

    createBlock(x, y, z, type = BLOCK_TYPES.GRASS) {
        let object3D;

        // PLANT
        if (type.isPlant) {
            const material = new THREE.MeshStandardMaterial({
                map: this.loadPixelTexture(type.texture),
                transparent: true,
                alphaTest: 0.5,
                side: THREE.DoubleSide
            });

            object3D = new THREE.Group();

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
            // XỬ LÝ CHẤT LỎNG
            const materialConfig = {
                color: 0xffffff, // THÊM DÒNG NÀY ĐỂ TRÁNH BỊ TÀNG HÌNH
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
            
            this.fluidMaterials.push(material);
        }
        // NORMAL BLOCK
        else {
            let materials;
            const materialConfig = {
                color: type.color || 0xffffff,
                transparent: type.transparent || false,
                opacity: type.opacity || 1,
            };

            if (type.textures) {
                materials = type.textures.map(url => new THREE.MeshStandardMaterial({
                    ...materialConfig, map: this.loadPixelTexture(url)
                }));
            } else if (type.texture) {
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
        object3D.userData.type = type;
        this.scene.add(object3D);
        return object3D;
    }

    updateFluids(delta) {

    // Đồng hồ animation nội bộ
    this.internalTime += delta;

    this.fluidMaterials.forEach(mat => {

        const texture = mat.map;

        if (!texture) return;

        // Lấy metadata đã lưu khi load sprite sheet
        const metadata = texture.userData.animationMetadata;

        // Nếu không phải sprite sheet thì bỏ qua
        if (!metadata) return;

        const { frames, frameRatio } = metadata;

        // Tính frame hiện tại
        const frame =
            Math.floor(this.internalTime * this.FLUID_ANIMATION_FPS)
            % frames;

        // Nhảy frame theo sprite sheet
        texture.offset.y = 1 - frameRatio * (frame + 1);
    });
}
}