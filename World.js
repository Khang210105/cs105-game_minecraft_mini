import * as THREE from "three";
import { BLOCK_TYPES } from "./blocks.js";

export class World {
	constructor(blockEngine) {
		this.engine = blockEngine;
		this.blocks = [];
		this.blockMap = new Map();

		// Hiệu ứng particles (animation khi đập block)
		this.particles = [];
		this.particleGeometries = [
			new THREE.BoxGeometry(0.1, 0.1, 0.1),
			new THREE.BoxGeometry(0.15, 0.15, 0.15),
			new THREE.BoxGeometry(0.2, 0.2, 0.2),
			new THREE.BoxGeometry(0.25, 0.25, 0.25),
		];
		this.textureImageCache = new Map();
		this.textureLoader = new THREE.TextureLoader();

		// lava/water bucket
		this.activeFluids = []; // Chứa các khối nước đang chảy
		this.fluidTickTimer = 0; // Bộ đếm thời gian
		this.animatingFluids = [];
		this.activeLavaBlocks = [];
		this.lavaPopTimer = 0;

		// Sky & Day/Night
		this.cameraWorldPos = new THREE.Vector3();
		this.skyColorDay = new THREE.Color(0x87ceeb);
		this.skyColorNight = new THREE.Color(0x0b1026);
		this.timeOfDay = Math.PI / 4;
		this.enableDayNightCycle = true;
		this.lastScene = null;
		this.lastCamera = null;

		this.maxLocalLights = 8;
		this.localLightRadius = 10;
		this.localLightIntensity = 1.1;
		this.localLightShadowCount = 2;
		this.localLightPool = [];
		this.lightQueryPos = new THREE.Vector3();

		this.initEnvironmentObjects();
		this.createVoxelClouds();
	}

	initEnvironmentObjects() {
		this.sunLight = new THREE.DirectionalLight(0xfff4e5, 1.2);
		this.sunLight.castShadow = true;
		this.sunLight.position.set(50, 100, 50);
		this.sunLight.shadow.mapSize.width = 2048;
		this.sunLight.shadow.mapSize.height = 2048;
		this.sunLight.shadow.camera.near = 0.5;
		this.sunLight.shadow.camera.far = 150;
		this.sunLight.shadow.camera.left = -50;
		this.sunLight.shadow.camera.right = 50;
		this.sunLight.shadow.camera.top = 50;
		this.sunLight.shadow.camera.bottom = -50;
		this.sunLight.shadow.bias = -0.00015;
		this.sunLight.shadow.normalBias = 0.03;
		this.sunLight.target.position.set(0, 0, 0);
		this.engine.scene.add(this.sunLight);
		this.engine.scene.add(this.sunLight.target);

		this.sunMesh = new THREE.Mesh(
			new THREE.SphereGeometry(1.8, 32, 32),
			new THREE.MeshBasicMaterial({ color: 0xffdd66 }),
		);
		this.sunMesh.position.copy(this.sunLight.position);
		this.engine.scene.add(this.sunMesh);

		this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
		this.engine.scene.add(this.ambientLight);

		this.moonLight = new THREE.DirectionalLight(0x9fb6ff, 0.25);
		this.moonLight.castShadow = true;
		this.moonLight.position.set(-50, 80, -50);
		this.moonLight.shadow.mapSize.width = 1024;
		this.moonLight.shadow.mapSize.height = 1024;
		this.moonLight.shadow.camera.near = 0.5;
		this.moonLight.shadow.camera.far = 140;
		this.moonLight.shadow.camera.left = -45;
		this.moonLight.shadow.camera.right = 45;
		this.moonLight.shadow.camera.top = 45;
		this.moonLight.shadow.camera.bottom = -45;
		this.moonLight.shadow.bias = -0.0002;
		this.moonLight.shadow.normalBias = 0.025;
		this.moonLight.target.position.set(0, 0, 0);
		this.engine.scene.add(this.moonLight);
		this.engine.scene.add(this.moonLight.target);

		this.moonMesh = new THREE.Mesh(
			new THREE.SphereGeometry(1.3, 24, 24),
			new THREE.MeshBasicMaterial({ color: 0xbcd7ff }),
		);
		this.moonMesh.position.copy(this.moonLight.position);
		this.engine.scene.add(this.moonMesh);

		this.initLocalLights();
	}

	initLocalLights() {
		this.localLightPool = [];

		for (let i = 0; i < this.maxLocalLights; i++) {
			const light = new THREE.PointLight(0xff7a3d, 0, this.localLightRadius, 2);
			light.visible = false;
			light.castShadow = i < this.localLightShadowCount;
			if (light.castShadow) {
				light.shadow.mapSize.width = 256;
				light.shadow.mapSize.height = 256;
				light.shadow.bias = -0.0001;
			}
			this.engine.scene.add(light);
			this.localLightPool.push(light);
		}
	}

	createVoxelClouds() {
		this.cloudGroup = new THREE.Group();
		this.cloudGroup.position.y = 70;
		const cloudGeo = new THREE.BoxGeometry(4, 2, 4);
		const cloudMat = new THREE.MeshBasicMaterial({
			color: 0xffffff,
			transparent: true,
			opacity: 0.8,
			depthWrite: false,
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
					cz + (Math.random() - 0.5) * 15,
				);
				this.cloudGroup.add(cloudBlock);
			}
		}
		this.engine.scene.add(this.cloudGroup);
	}

	normalizeTime() {
		const fullDay = Math.PI * 2;
		this.timeOfDay = ((this.timeOfDay % fullDay) + fullDay) % fullDay;
	}

	getTimeHours() {
		this.normalizeTime();
		return (((this.timeOfDay + Math.PI / 2) / (Math.PI * 2)) * 24 + 24) % 24;
	}
	setTimeHours(hours, scene = this.lastScene, camera = this.lastCamera) {
		const clampedHours = Math.max(0, Math.min(24, Number(hours) || 0));
		this.timeOfDay = (clampedHours / 24) * Math.PI * 2 - Math.PI / 2;
		this.normalizeTime();

		if (scene && camera) {
			this.applyDayNight(scene, camera);
		}
	}

	applyDayNight(scene, camera) {
		if (!scene || !camera) return;

		const radius = 60;
		camera.getWorldPosition(this.cameraWorldPos);

		const px = this.cameraWorldPos.x;
		const py = this.cameraWorldPos.y;
		const pz = this.cameraWorldPos.z;

		const x = px + radius * Math.cos(this.timeOfDay);
		const y = py + radius * Math.sin(this.timeOfDay);

		this.sunLight.position.set(x, y, pz);
		this.sunMesh.position.copy(this.sunLight.position);

		this.sunLight.target.position.set(px, py, pz);
		this.sunLight.target.updateMatrixWorld();

		const daylight = Math.max(0, Math.min(1, (y - py) / radius + 0.2));
		const nightFactor = 1 - daylight;

		scene.background = new THREE.Color().lerpColors(
			this.skyColorNight,
			this.skyColorDay,
			daylight,
		);

		this.sunLight.intensity = 0.15 + daylight * 1.05;
		this.ambientLight.intensity = 0.15 + daylight * 0.3;

		const moonX = px - radius * Math.cos(this.timeOfDay);
		const moonY = py - radius * Math.sin(this.timeOfDay);
		this.moonLight.position.set(moonX, moonY, pz);
		this.moonMesh.position.copy(this.moonLight.position);
		this.moonLight.target.position.set(px, py, pz);
		this.moonLight.target.updateMatrixWorld();
		this.moonLight.intensity = 0.05 + nightFactor * 0.45;
		this.moonLight.visible = nightFactor > 0.02;
		this.moonMesh.visible = this.moonLight.visible;

		this.cameraRef = camera;
	}

	updateDayNightCycle(delta, scene, camera) {
		this.lastScene = scene;
		this.lastCamera = camera;

		if (this.enableDayNightCycle) {
			this.timeOfDay += delta * 0.03;
			this.normalizeTime();
		}

		this.applyDayNight(scene, camera);
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
		newBlock.castShadow = y > 0 && !type.isFluid && !type.transparent;
		newBlock.receiveShadow = !type.isFluid;
		newBlock.userData.gridPos = { x, y, z };

		this.blocks.push(newBlock);
		const key = this.getKey(x, y, z);
		this.blockMap.set(key, newBlock);

		// --- HỆ THỐNG CAO ĐỘ NƯỚC/LAVA CHUẨN XÁC ---
		if (type.isFluid) {
			newBlock.userData.flowLevel =
				flowLevel !== null ? flowLevel : type.maxFlow;
			newBlock.userData.isSource = flowLevel === null || isSource;

			const targetHeight = Math.max(
				0.1,
				(newBlock.userData.flowLevel / type.maxFlow) * 0.9,
			);
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
			if (block.userData.isDraining) continue;
			const flowLevel = block.userData.flowLevel;
			if (!block.userData.isSource) {
				let hasSupport = false;

				const checkDirs = [
					{ dx: 1, dz: 0 },
					{ dx: -1, dz: 0 },
					{ dx: 0, dz: 1 },
					{ dx: 0, dz: -1 },
					{ dx: 0, dz: 0, dy: 1 },
				];

				for (const dir of checkDirs) {
					const neighbor = this.getBlock(
						x + (dir.dx || 0),
						y + (dir.dy || 0),
						z + (dir.dz || 0),
					);

					if (neighbor && neighbor.userData.type.id === type.id) {
						// Nước phía trên luôn cấp nước được
						if ((dir.dy || 0) === 1) {
							hasSupport = true;
							break;
						}

						// Nước ngang phải mạnh hơn mình
						if (neighbor.userData.flowLevel > block.userData.flowLevel) {
							hasSupport = true;
							break;
						}
					}
				}

				// Không còn được cấp nước -> tự biến mất
				if (!hasSupport) {
					block.userData.isDraining = true;

					const drainInterval = setInterval(() => {
						if (!this.blocks.includes(block)) {
							clearInterval(drainInterval);
							return;
						}

						block.scale.y -= 0.03;
						block.position.y -= 0.015;

						if (block.scale.y <= 0.05) {
							clearInterval(drainInterval);
							this.removeBlock(block);
						}
					}, 16);

					continue;
				}
			}
			let keepActive = false; // --- MỚI: Biến quyết định xem block này có ngủ hay không ---

			// 1. ƯU TIÊN CHẢY XUỐNG DƯỚI
			const blockBelow = this.getBlock(x, y - 1, z);
			if (!blockBelow || !blockBelow.userData.type.solid) {
				if (!blockBelow || blockBelow.userData.type.id !== type.id) {
					this.addBlock(x, y - 1, z, type, type.maxFlow, false);
					keepActive = true;
				}
				this.activeFluids.push(block); // Rơi thì luôn thức để dò đáy
				continue;
			}

			// 2. CHẢY SANG NGANG NẾU BÊN DƯỚI LÀ MẶT ĐẤT
			if (flowLevel > 0) {
				const directions = [
					{ dx: 1, dz: 0 },
					{ dx: -1, dz: 0 },
					{ dx: 0, dz: 1 },
					{ dx: 0, dz: -1 },
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

	spawnLavaSpark(pos) {
		// Kích thước to hơn chút để trông giống giọt dung nham
		const size = 0.08 + Math.random() * 0.06;
		const geometry = new THREE.BoxGeometry(size, size, size);

		// Chỉ dùng các tông màu rực của dung nham (Cam, Cam Đỏ, Vàng Cam)
		const colors = [0xff4400, 0xff6600, 0xffaa00];
		const color = colors[Math.floor(Math.random() * colors.length)];

		const material = new THREE.MeshBasicMaterial({
			color: color,
			transparent: true,
		});
		const particle = new THREE.Mesh(geometry, material);

		particle.position.set(
			pos.x + (Math.random() - 0.5) * 0.8,
			pos.y + 0.5, // Nằm ngay sát mặt dung nham
			pos.z + (Math.random() - 0.5) * 0.8,
		);

		// Vận tốc: Bắn "bụp" thẳng lên trời, hơi dạt ra xung quanh một chút
		particle.velocity = new THREE.Vector3(
			(Math.random() - 0.5) * 1.5, // Dạt X
			Math.random() * 1.5 + 2.5, // Bật mạnh lên Y
			(Math.random() - 0.5) * 1.5, // Dạt Z
		);

		// Thời gian sống cực ngắn (0.3 đến 0.6 giây) để cảm giác nổ chớp nhoáng
		particle.lifespan = 0.3 + Math.random() * 0.3;
		particle.maxLifespan = particle.lifespan;
		particle.isSpark = true;

		this.engine.scene.add(particle);
		this.particles.push(particle);
	}

	updateLavaParticles(deltaTime = 0.016) {
		for (let i = this.lavaParticles.length - 1; i >= 0; i--) {
			let p = this.lavaParticles[i];

			// 1. Di chuyển tàn lửa lên trên
			p.position.add(p.userData.velocity);

			// 2. Giảm thời gian sống
			p.userData.life -= deltaTime;

			// 3. Hiệu ứng mờ dần (Fade out) và thu nhỏ
			p.material.opacity = p.userData.life / p.userData.maxLife;
			const scale = p.userData.life / p.userData.maxLife;
			p.scale.set(scale, scale, scale);

			// 4. Khi hết tuổi thọ -> Xóa hạt để giải phóng bộ nhớ
			if (p.userData.life <= 0) {
				this.scene.remove(p);
				p.geometry.dispose(); // Bắt buộc để chống tràn RAM
				p.material.dispose();
				this.particles.splice(i, 1);
			}
		}
	}

	removeBlock(mesh) {
		if (!mesh) return;
		const x = mesh.userData.gridPos
			? mesh.userData.gridPos.x
			: Math.round(mesh.position.x);
		const y = mesh.userData.gridPos
			? mesh.userData.gridPos.y
			: Math.round(mesh.position.y);
		const z = mesh.userData.gridPos
			? mesh.userData.gridPos.z
			: Math.round(mesh.position.z);
		this.engine.scene.remove(mesh);
		this.blocks = this.blocks.filter((b) => b !== mesh);
		this.blockMap.delete(this.getKey(x, y, z));
		if (mesh.userData.type && !mesh.userData.type.isFluid) {
			this.spawnBreakParticles(mesh.position, mesh.userData.type);
		}
		if (mesh.userData && mesh.userData.type.id === BLOCK_TYPES.LAVA.id) {
			this.activeLavaBlocks = this.activeLavaBlocks.filter((b) => b !== mesh);
		}
		if (mesh.userData && mesh.userData.gridPos) {
			const { x, y, z } = mesh.userData.gridPos;
			const dirs = [
				{ dx: 1, dy: 0, dz: 0 },
				{ dx: -1, dy: 0, dz: 0 },
				{ dx: 0, dy: -1, dz: 0 },
				{ dx: 0, dy: 1, dz: 0 },
				{ dx: 0, dy: 0, dz: 1 },
				{ dx: 0, dy: 0, dz: -1 },
			];

			for (let dir of dirs) {
				const neighbor = this.getBlock(x + dir.dx, y + dir.dy, z + dir.dz);
				if (
					neighbor &&
					neighbor.userData &&
					neighbor.userData.type &&
					neighbor.userData.type.isFluid
				) {
					if (!this.activeFluids.includes(neighbor)) {
						this.activeFluids.push(neighbor);
					}
				}
			}
		}
	}

	async loadTextureImage(texturePath) {
		if (!texturePath) return null;
		if (this.textureImageCache.has(texturePath))
			return this.textureImageCache.get(texturePath);
		try {
			const img = new Image();
			img.crossOrigin = "anonymous";
			return new Promise((resolve) => {
				img.onload = () => {
					this.textureImageCache.set(texturePath, img);
					resolve(img);
				};
				img.onerror = () => resolve(null);
				img.src = texturePath;
			});
		} catch (e) {
			return null;
		}
	}

	createRandomCropTexture(textureImage, cropSize = 5) {
		const canvas = document.createElement("canvas");
		canvas.width = cropSize;
		canvas.height = cropSize;
		const ctx = canvas.getContext("2d");
		if (!textureImage) {
			ctx.fillStyle = "#8b8b8b";
			ctx.fillRect(0, 0, cropSize, cropSize);
			const tex = new THREE.CanvasTexture(canvas);
			tex.colorSpace = THREE.SRGBColorSpace;
			return tex;
		}
		const cropX = Math.random() * Math.max(0, textureImage.width - cropSize);
		const cropY = Math.random() * Math.max(0, textureImage.height - cropSize);
		ctx.drawImage(
			textureImage,
			cropX,
			cropY,
			cropSize,
			cropSize,
			0,
			0,
			cropSize,
			cropSize,
		);
		const tex = new THREE.CanvasTexture(canvas);
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.magFilter = tex.minFilter = THREE.NearestFilter;
		return tex;
	}

	async spawnBreakParticles(pos, blockType) {
		const texImg = await this.loadTextureImage(
			blockType.texture || (blockType.textures ? blockType.textures[0] : null),
		);
		for (let i = 0; i < 16; i++) {
			const pTexture = this.createRandomCropTexture(texImg);
			pTexture.colorSpace = THREE.SRGBColorSpace;
			pTexture.magFilter = THREE.NearestFilter;
			pTexture.minFilter = THREE.NearestFilter;
			const material = new THREE.MeshLambertMaterial({
				map: pTexture,
				color: 0xffffff,
				transparent: true,
				flatShading: true,
			});
			const p = new THREE.Mesh(
				this.particleGeometries[Math.floor(Math.random() * 4)],
				material,
			);
			p.position.set(
				pos.x + (Math.random() - 0.5) * 0.6,
				pos.y + (Math.random() - 0.5) * 0.6,
				pos.z + (Math.random() - 0.5) * 0.6,
			);
			p.velocity = new THREE.Vector3(
				(Math.random() - 0.5) * 8,
				Math.random() * 4 + 2,
				(Math.random() - 0.5) * 8,
			);
			p.lifespan = 0.4 + Math.random() * 0.5;
			this.engine.scene.add(p);
			this.particles.push(p);
		}
	}

	update(delta) {
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
					// [A] DÀNH CHO TÀN LỬA LAVA (Bay lên, mờ dần)
					p.velocity.y -= 12.0 * delta;
					p.position.addScaledVector(p.velocity, delta);

					// Hiệu ứng mờ dần và thu nhỏ
					const scale = p.lifespan / p.maxLifespan;
					p.scale.set(scale, scale, scale);
					if (p.material) p.material.opacity = scale;
				} else {
					// [B] DÀNH CHO MẢNH VỠ BLOCK (Đập đá, đất...)
					p.velocity.y -= 15.0 * delta; // Trọng lực
					p.position.addScaledVector(p.velocity, delta);

					// Xoay mảnh vụn
					p.rotation.x += p.velocity.x * delta;
					p.rotation.y += p.velocity.y * delta;
				}
			}
		}
		if (this.cloudGroup && this.player && this.player.camera) {
			const px = this.player.camera.position.x;
			const pz = this.player.camera.position.z;
			const limit = 120;
			this.cloudGroup.children.forEach((c) => {
				c.position.x -= 0.03;
				if (c.position.x < px - limit) c.position.x += limit * 2;
				else if (c.position.x > px + limit) c.position.x -= limit * 2;
				if (c.position.z < pz - limit) c.position.z += limit * 2;
				else if (c.position.z > pz + limit) c.position.z -= limit * 2;
			});
		}
		if (this.activeLavaBlocks.length > 0) {
			// Cộng dồn thời gian mỗi khung hình
			this.lavaPopTimer += delta;

			// Cứ đủ 1 giây (1.0) thì cho nổ
			if (this.lavaPopTimer >= 1.0) {
				// Reset đồng hồ về 0 để đếm lại từ đầu
				this.lavaPopTimer = 0;

				// Chọn ngẫu nhiên số lượng ô lava sẽ nổ (Ví dụ: 1 đến 3 ô nổ cùng lúc)
				// Nếu map có quá ít lava (nhỏ hơn 3) thì lấy giới hạn bằng số lượng lava hiện có
				const numPops = Math.min(
					this.activeLavaBlocks.length,
					Math.floor(Math.random() * 3) + 1,
				);

				for (let i = 0; i < numPops; i++) {
					// Bốc ngẫu nhiên 1 ô lava trong danh sách (kể cả ô gốc lẫn ô chảy lan)
					const randomIndex = Math.floor(
						Math.random() * this.activeLavaBlocks.length,
					);
					const randomLavaBlock = this.activeLavaBlocks[randomIndex];

					// Gọi hàm bắn bong bóng tại tọa độ của ô đó
					this.spawnLavaSpark(randomLavaBlock.position);
				}
			}
		}

		this.updateLocalLights();
	}

	updateLocalLights() {
		if (!this.localLightPool || this.localLightPool.length === 0) return;

		const focus =
			this.player && this.player.camera ? this.player.camera.position : null;
		if (!focus || this.activeLavaBlocks.length === 0) {
			this.localLightPool.forEach((light) => {
				light.visible = false;
			});
			return;
		}

		const radiusSq = this.localLightRadius * this.localLightRadius * 4;
		const candidates = [];

		for (let i = 0; i < this.activeLavaBlocks.length; i++) {
			const block = this.activeLavaBlocks[i];
			const dx = block.position.x - focus.x;
			const dy = block.position.y - focus.y;
			const dz = block.position.z - focus.z;
			const distSq = dx * dx + dy * dy + dz * dz;

			if (distSq <= radiusSq) {
				candidates.push({ block, distSq });
			}
		}

		candidates.sort((a, b) => a.distSq - b.distSq);

		for (let i = 0; i < this.localLightPool.length; i++) {
			const light = this.localLightPool[i];
			const entry = candidates[i];

			if (!entry) {
				light.visible = false;
				continue;
			}

			const blockPos = entry.block.position;
			light.position.set(blockPos.x, blockPos.y + 0.3, blockPos.z);
			light.distance = this.localLightRadius;
			light.intensity =
				this.localLightIntensity * (1 - Math.min(1, entry.distSq / radiusSq));
			light.visible = true;
		}
	}

	clearWaterNetwork(sx, sy, sz, fluidId) {
		sx = Math.round(sx);
		sy = Math.round(sy);
		sz = Math.round(sz);

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
					if (this.getBlock(x, y, z) !== block) return;

					// Chặn lan tiếp
					block.userData.isDraining = true;

					// Lava chậm hơn nước
					const drainSpeed = fluidId === BLOCK_TYPES.LAVA.id ? 0.006 : 0.015;

					const drainInterval = setInterval(() => {
						// Nếu block đã bị xóa
						if (!this.blocks.includes(block)) {
							clearInterval(drainInterval);
							return;
						}

						// Co dần chiều cao
						block.scale.y -= drainSpeed;

						// Chìm xuống nhẹ
						block.position.y -= drainSpeed * 0.5;

						// Biến mất hoàn toàn
						if (block.scale.y <= 0.05) {
							clearInterval(drainInterval);
							this.removeBlock(block);
							return;
						}
					}, 16);
				}, dist * 180);

				// Quét 6 hướng để lan tỏa hiệu ứng rút nước
				const directions = [
					{ dx: 1, dy: 0, dz: 0 },
					{ dx: -1, dy: 0, dz: 0 },
					{ dx: 0, dy: -1, dz: 0 },
					{ dx: 0, dy: 1, dz: 0 },
					{ dx: 0, dy: 0, dz: 1 },
					{ dx: 0, dy: 0, dz: -1 },
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
