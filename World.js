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
        // Tạo các geometry với kích thước khác nhau cho particles
		this.particleGeometries = [
			new THREE.BoxGeometry(0.1, 0.1, 0.1), // Tiny dust
			new THREE.BoxGeometry(0.15, 0.15, 0.15), // Small chunk
			new THREE.BoxGeometry(0.2, 0.2, 0.2), // Medium chunk
			new THREE.BoxGeometry(0.25, 0.25, 0.25), // Larger chunk
		];

        // Cache để lưu texture images
		this.textureImageCache = new Map();

        // Texture loader
		this.textureLoader = new THREE.TextureLoader();

        // --- MỚI: HỆ THỐNG CHẤT LỎNG ---
        this.activeFluids = []; // Chứa các khối nước đang chảy
        this.fluidTickTimer = 0; // Bộ đếm thời gian

        this.animatingFluids = []; // --- MỚI: Danh sách khối nước đang dâng lên ---
        // --- MỚI: Mảng lưu trữ tàn lửa/khói ---
        this.particles = [];
        this.activeLavaBlocks = [];

        // --- MỚI: Đồng hồ đếm thời gian nổ bong bóng ---
        this.lavaPopTimer = 0;

        // Bên trong constructor() của World.js
        this.createVoxelClouds();

        this.initSunAndShadows(); // sun và shadow
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

    // Hàm load texture image và cache nó
	async loadTextureImage(texturePath) {
		// Nếu đã cached, trả về ngay
		if (this.textureImageCache.has(texturePath)) {
			return this.textureImageCache.get(texturePath);
		}

		try {
			const img = new Image();
			img.crossOrigin = "anonymous";

			return new Promise((resolve) => {
				img.onload = () => {
					this.textureImageCache.set(texturePath, img);
					resolve(img);
				};

				img.onerror = () => {
					resolve(null);
				};

				img.src = texturePath;
			});
		} catch (e) {
			return null;
		}
	}

    // Tạo canvas texture từ random crop của original texture
	createRandomCropTexture(textureImage, cropSize = 5) {
		const canvas = document.createElement("canvas");
		canvas.width = cropSize;
		canvas.height = cropSize;
		const ctx = canvas.getContext("2d");

		if (!textureImage) {
			// Nếu không có image, vẽ màu xám
			ctx.fillStyle = "#8b8b8b";
			ctx.fillRect(0, 0, cropSize, cropSize);
			return new THREE.CanvasTexture(canvas);
		}

		// Random crop từ texture
		const maxX = Math.max(0, textureImage.width - cropSize);
		const maxY = Math.max(0, textureImage.height - cropSize);
		const cropX = Math.random() * maxX;
		const cropY = Math.random() * maxY;

		// Vẽ random crop của texture lên canvas
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

		const canvasTexture = new THREE.CanvasTexture(canvas);
		canvasTexture.magFilter = THREE.NearestFilter;
		canvasTexture.minFilter = THREE.NearestFilter;
		canvasTexture.colorSpace = THREE.SRGBColorSpace;

		return canvasTexture;
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
        if (!mesh) return;

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

        // --- BÙA HỘ MỆNH: Kiểm tra an toàn tuyệt đối ---
        const isFluid = mesh.userData && mesh.userData.type && mesh.userData.type.isFluid === true;
        const isLava = mesh.userData && mesh.userData.type && mesh.userData.type.id === BLOCK_TYPES.LAVA.id;

        // 3. Chỉ tạo hạt vỡ nếu không phải là chất lỏng
        if (!isFluid) {
            this.spawnBreakParticles(mesh.position, blockMaterial);
        }   
        
        // 4. Hủy đăng ký nếu đó là Lava
        if (isLava) {
            this.activeLavaBlocks = this.activeLavaBlocks.filter(b => b !== mesh);
        }
        
        // 5. ĐÁNH THỨC NƯỚC XUNG QUANH CHẢY VÀO CHỖ TRỐNG
        // Lấy tọa độ trực tiếp từ mesh.position (an toàn 100% cho mọi khối đất đá)
        const x = Math.round(mesh.position.x);
        const y = Math.round(mesh.position.y);
        const z = Math.round(mesh.position.z);
        
        const dirs = [
            {dx: 1, dy: 0, dz: 0}, {dx: -1, dy: 0, dz: 0},
            {dx: 0, dy: -1, dz: 0}, {dx: 0, dy: 1, dz: 0},
            {dx: 0, dy: 0, dz: 1}, {dx: 0, dy: 0, dz: -1}
        ];
        
        for (let dir of dirs) {
            const neighbor = this.getBlock(x + dir.dx, y + dir.dy, z + dir.dz);
            // Kiểm tra xem hàng xóm có phải là chất lỏng không (có bùa hộ mệnh)
            if (neighbor && neighbor.userData && neighbor.userData.type && neighbor.userData.type.isFluid) {
                // Đánh thức nước/lava đang ngủ
                if (!this.activeFluids.includes(neighbor)) {
                    this.activeFluids.push(neighbor);
                }
            }
        }
    }

    async spawnBreakParticles(pos, blockType) {
		// Lấy texture path từ block type
		let texturePath = blockType.texture;
		if (!texturePath && blockType.textures) {
			// Nếu có nhiều textures, lấy cái đầu tiên
			texturePath = blockType.textures[0];
		}

		// Load texture image
		const textureImage = texturePath
			? await this.loadTextureImage(texturePath)
			: null;

		// Tạo ra 24 mảnh vụn với sizes khác nhau
		for (let i = 0; i < 24; i++) {
			// Chọn geometry ngẫu nhiên (sizes khác nhau)
			const geom =
				this.particleGeometries[
					Math.floor(Math.random() * this.particleGeometries.length)
				];

			// Tạo random crop texture cho particle này
			const particleTexture = this.createRandomCropTexture(textureImage);

			// Tạo material với texture crop
			const particleMaterial = new THREE.MeshStandardMaterial({
				map: particleTexture,
				roughness: 0.8,
				metalness: 0,
				transparent: true,
				opacity: 1,
				emissive: new THREE.Color(0x000000),
			});

			const particle = new THREE.Mesh(geom, particleMaterial);

			// Vị trí ban đầu: Troll ngẫu nhiên bên trong khối block
			particle.position.set(
				pos.x + (Math.random() - 0.5) * 0.8,
				pos.y + (Math.random() - 0.5) * 0.8,
				pos.z + (Math.random() - 0.5) * 0.8,
			);

			// Vận tốc văng mạnh hơn và ngẫu nhiên hơn
			const speed = 4 + Math.random() * 5; // 4-9 units/sec
			const phi = Math.random() * Math.PI * 2; // Angle in XZ plane
			const theta = Math.random() * Math.PI * 0.6 + Math.PI * 0.2; // Mostly upward

			particle.velocity = new THREE.Vector3(
				Math.sin(theta) * Math.cos(phi) * speed,
				Math.cos(theta) * speed + 2, // Thêm momentum lên trên
				Math.sin(theta) * Math.sin(phi) * speed,
			);

			// Thời gian sống ngẫu nhiên (0.3 -> 0.9 giây)
			particle.lifespan = 0.3 + Math.random() * 0.6;
			particle.maxLifespan = particle.lifespan;

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
        // --- THÊM 2 DÒNG NÀY ---
        newBlock.castShadow = true;    // Cho phép block tạo ra bóng
        newBlock.receiveShadow = true; // Cho phép block in bóng của thằng khác lên mình
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
        // --- CHO MÂY KHỐI 3D TRÔI VÀ BÁM THEO NGƯỜI CHƠI ---
        if (this.cloudGroup && this.player && this.player.camera) {
            const px = this.player.camera.position.x;
            const pz = this.player.camera.position.z;
            const skyLimit = 100; // Tầm nhìn mây xa tối đa (khoảng cách 100 block)

            // Duyệt qua từng khối mây con
            this.cloudGroup.children.forEach(cloudBlock => {
                // Mây trôi từ từ theo trục X
                cloudBlock.position.x -= 0.03; 

                // Nếu mây bay khuất tầm nhìn phía Tây, dịch nó quay lại ranh giới phía Đông
                if (cloudBlock.position.x < px - skyLimit) {
                    cloudBlock.position.x += skyLimit * 2;
                } else if (cloudBlock.position.x > px + skyLimit) {
                    cloudBlock.position.x -= skyLimit * 2;
                }

                // Nếu người chơi đi xa quá theo trục Z, cũng tự động kéo mây theo
                if (cloudBlock.position.z < pz - skyLimit) {
                    cloudBlock.position.z += skyLimit * 2;
                } else if (cloudBlock.position.z > pz + skyLimit) {
                    cloudBlock.position.z -= skyLimit * 2;
                }
            });
        }
        // xử lí chuyển động của mặt trời
        // Kiểm tra an toàn
        // 4. --- CHỈNH SỬA CHUYỂN ĐỘNG CỦA MẶT TRỜI 3D ---
        // Đã đổi sunSprite -> sunMesh và GIẢM TỐC ĐỘ thời gian
        if (this.sunLight && this.sunMesh && this.player && this.player.camera) {
            
            // --- MỚI: GIẢM TỐC ĐỘ THỜI GIAN ĐÁNG KỂ ---
            // Số càng nhỏ thời gian trôi càng chậm. (0.0001 là rất chậm và tự nhiên)
            this.timeOfDay += 0.002; 
            
            // Lấy tọa độ thế giới camera (anti-bug dính block)
            this.player.camera.getWorldPosition(this.cameraWorldPos);
            const px = this.cameraWorldPos.x;
            const py = this.cameraWorldPos.y;
            const pz = this.cameraWorldPos.z;

            // Bán kính quỹ đạo
            const sunRadius = 200; 

            // QUỸ ĐẠO VÒNG TRÒN (Giữ nguyên logic)
            const sunX = Math.cos(this.timeOfDay) * sunRadius;
            const sunY = Math.sin(this.timeOfDay) * sunRadius;
            
            // Đặt vị trí cục Mặt Trời 3D (sunMesh)
            this.sunMesh.position.set(px + sunX, py + sunY, pz);
            
            // Nguồn sáng đi cùng
            this.sunLight.position.set(px + sunX, py + sunY, pz);
            this.sunLight.target.position.set(px, 0, pz); 
            this.sunLight.target.updateMatrixWorld();

            // XỬ LÝ ĐỘ SÁNG THEO sunY (Giữ nguyên logic)
            if (sunY > 0) {
                const maxIntensity = 1.2;
                this.sunLight.intensity = Math.min(maxIntensity, (sunY / sunRadius) * maxIntensity * 2);
                this.ambientLight.intensity = 0.4;
                
                // Hiển thị cục mặt trời
                this.sunMesh.visible = true;
            } else {
                this.sunLight.intensity = 0;
                this.ambientLight.intensity = 0.1; // Trời tối đen
                
                // Ẩn cục mặt trời
                this.sunMesh.visible = false;
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
    // ==========================================
    // HỆ THỐNG MÂY 3D (VOXEL CLOUDS)
    // ==========================================
    createVoxelClouds() {
        this.cloudGroup = new THREE.Group();
        this.cloudGroup.position.y = 50; // Độ cao của tầng mây

        // Dùng 1 hình học và 1 vật liệu chung cho tất cả khối mây để tối ưu FPS
        // Kích thước 1 khối mây: rộng 4, cao 2, sâu 4 (to hơn block đất bình thường)
        const cloudGeo = new THREE.BoxGeometry(4, 2, 4);
        const cloudMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8, // Hơi trong suốt một chút
            depthWrite: false // Chống lỗi nhấp nháy đồ họa
        });

        const numClouds = 30; // Số lượng CỤM mây
        const spread = 200;   // Phạm vi bầu trời (200x200)

        for (let c = 0; c < numClouds; c++) {
            // Chọn tọa độ tâm ngẫu nhiên cho cụm mây này
            const cx = (Math.random() - 0.5) * spread;
            const cz = (Math.random() - 0.5) * spread;
            
            // Mỗi cụm sẽ gồm từ 5 đến 15 khối ghép lại với nhau ngẫu nhiên
            const blocksPerCluster = 10 + Math.floor(Math.random() * 15);
            
            for (let i = 0; i < blocksPerCluster; i++) {
                const cloudBlock = new THREE.Mesh(cloudGeo, cloudMat);
                
                // Đặt vị trí các khối con xoay quanh tâm cụm mây
                cloudBlock.position.set(
                    cx + (Math.random() - 0.5) * 12, 
                    Math.floor((Math.random() - 0.5) * 2) * 2, // Tạo độ nhấp nhô cho mây
                    cz + (Math.random() - 0.5) * 12
                );
                
                this.cloudGroup.add(cloudBlock);
            }
        }

        this.engine.scene.add(this.cloudGroup);
    }
    // ==========================================
    // HỆ THỐNG MẶT TRỜI & BÓNG ĐỔ
    // ==========================================
    // ==========================================
    // HỆ THỐNG MẶT TRỜI (HÀNG HIỆU THREE.JS) & BÓNG ĐỔ
    // ==========================================
    initSunAndShadows() {
        // 1. Ánh sáng môi trường (Giữ nguyên)
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.engine.scene.add(this.ambientLight);

        // 2. Ánh sáng Mặt Trời (Tạo bóng đổ - Giữ nguyên)
        this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.sunLight.castShadow = true;
        
        const d = 50; 
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;
        
        this.sunLight.shadow.camera.near = 1;
        this.sunLight.shadow.camera.far = 500; 
        this.sunLight.shadow.mapSize.width = 1024;
        this.sunLight.shadow.mapSize.height = 1024;

        this.engine.scene.add(this.sunLight);
        this.engine.scene.add(this.sunLight.target);

        // 3. --- MỚI: TẠO MẶT TRỜI KHỐI 3D (KHÔNG DÙNG PNG) ---
        // Dùng hình cầu (SphereGeometry) để trông có khối 3D
        // Bán kính 10, 32 đường kinh tuyến, 16 đường vĩ tuyến (cho tròn trịa)
        const sunGeo = new THREE.SphereGeometry(10, 32, 16);
        
        // Dùng MeshBasicMaterial để mặt trời tự phát sáng, không bị bóng tối đè lên
        // Màu vàng sáng ngả trắng (0xffffcc)
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
        
        this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
        this.engine.scene.add(this.sunMesh);

        // Biến thời gian, bắt đầu lúc mọc (0)
        this.timeOfDay = 0; 

        // Biến phụ chứa tọa độ thế giới của camera
        this.cameraWorldPos = new THREE.Vector3();
    }
}