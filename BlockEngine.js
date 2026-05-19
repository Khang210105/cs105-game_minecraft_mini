// BlockEngine.js
// Quản lý các tính năng của 1 Block, vd như tạo Texture cho Block

import * as THREE from "three";
import { BLOCK_TYPES } from "./blocks.js";

export class BlockEngine {
	constructor(scene) {
		this.scene = scene;

		this.cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
		this.planeGeometry = new THREE.PlaneGeometry(1, 1); // Dùng cho cây cỏ
		this.textureLoader = new THREE.TextureLoader();

		// Danh sách material chất lỏng để animate sprite sheet
		this.fluidMaterials = [];

		// Đồng hồ animation nội bộ
		this.internalTime = 0;

		// Tốc độ animation (khung hình/giây)
		this.FLUID_ANIMATION_FPS = 10;
	}

	loadPixelTexture(url) {
		const texture = this.textureLoader.load(url, (tex) => {
			// Nếu ảnh là sprite sheet dạng dọc (cao > rộng)
			if (tex.image && tex.image.height > tex.image.width) {
				const frames = tex.image.height / tex.image.width;
				const frameRatio = 1 / frames;

				// Chỉ hiện 1 frame theo chiều dọc
				tex.repeat.set(1, frameRatio);
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

		// PLANT (2 plane cross)
		if (type.isPlant) {
			const plantTex =
				type.texture || (Array.isArray(type.textures) ? type.textures[0] : null);

			const material = new THREE.MeshStandardMaterial({
				map: plantTex ? this.loadPixelTexture(plantTex) : null,
				transparent: true,
				alphaTest: 0.5,
				side: THREE.DoubleSide,
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
		// FLUID (quay về box thường, không bo góc)
		else if (type.isFluid) {
			const materialConfig = {
				color: 0xffffff,
				map: this.loadPixelTexture(type.texture),
				transparent: type.transparent || false,
				opacity: type.opacity ?? 1,
			};

			if (type.emissive) {
				materialConfig.emissive = new THREE.Color(type.emissive);
				materialConfig.emissiveIntensity = type.intensity || 1;
			}

			const material = new THREE.MeshStandardMaterial(materialConfig);

			object3D = new THREE.Mesh(this.cubeGeometry, material);

			// Shadow cho fluid thường sẽ xấu/đắt, tuỳ game bạn (World.js đang set receiveShadow=false cho fluid)
			object3D.castShadow = false;
			object3D.receiveShadow = false;

			this.fluidMaterials.push(material);
		}
		// NORMAL BLOCK
		else {
			let materials;
			const materialConfig = {
				color: type.color || 0xffffff,
				transparent: type.transparent || false,
				opacity: type.opacity ?? 1,
			};

			if (type.textures) {
				materials = type.textures.map(
					(url) =>
						new THREE.MeshStandardMaterial({
							...materialConfig,
							map: this.loadPixelTexture(url),
						}),
				);
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

	// Animate sprite sheet cho water/lava (nếu texture là strip dọc)
	updateFluids(delta) {
		this.internalTime += delta;

		for (const mat of this.fluidMaterials) {
			const texture = mat.map;
			if (!texture) continue;

			const metadata = texture.userData.animationMetadata;
			if (!metadata) continue;

			const { frames, frameRatio } = metadata;

			const frame = Math.floor(this.internalTime * this.FLUID_ANIMATION_FPS) % frames;
			texture.offset.y = 1 - frameRatio * (frame + 1);
		}
	}
}