import { BLOCK_TYPES } from "./blocks.js";

/**
 * genMap (finite chunk terrain)
 * - Map hữu hạn (mặc định 30x30), sinh theo chunk
 * - Heightmap dùng sin/cos + seed (không dùng thư viện noise)
 * - preset: "plains" | "hills" | "mountains" | "mixed"
 * - Bedrock dưới cùng, từ bedrock lên mặt đất ~10 block (tunable)
 */
export class genMap {
	constructor(opts = {}) {
		this.mapSize = opts.mapSize ?? 20;
		this.chunkSize = opts.chunkSize ?? 10;

		this.baseY = opts.baseY ?? -4;

		// Độ dày từ bedrock lên tới mặt đất (tính cả dirt/stone/grass). Ví dụ 10.
		this.columnHeight = opts.columnHeight ?? 18;

		// bedrock nằm ở đáy cột
		this.bedrockY = opts.bedrockY ?? (this.baseY - this.columnHeight);

		// seed để map “ngẫu nhiên” nhưng tái lập được
		this.seed = opts.seed ?? Math.floor(Math.random() * 1e9);

		// preset: plains/hills/mountains/mixed
		this.preset = opts.preset ?? "mixed";

		// Tham số terrain
		this.amplitude = opts.amplitude;
		this.freq = opts.freq;
		this.octaves = opts.octaves;

		this.warp = opts.warp;

		// Clamp topY để không làm cột dày hơn columnHeight
		// (topY luôn <= baseY + (columnHeight-1) để đảm bảo bedrock->top khoảng 10)
		this.minTopY = opts.minTopY ?? (this.baseY - 2);
		// this.maxTopY = opts.maxTopY ?? (this.baseY + (this.columnHeight - 1));
		this.maxTopY = opts.maxTopY ?? (this.baseY + 8);

		this._applyPresetDefaults();
	}

	setPreset(preset) {
		this.preset = preset;
		this._applyPresetDefaults();
	}

	_applyPresetDefaults() {
		const p = this.preset;

		// Vì bạn giới hạn columnHeight ~ 10, amplitude lớn quá cũng bị clamp,
		// nên để mặc định vừa phải cho nhìn có đồi mà không “đụng trần” liên tục.
		if (p === "plains") {
			this.amplitude ??= 2;
			this.freq ??= 0.08;
			this.octaves ??= 2;
			this.warp ??= 0.12;
		} else if (p === "hills") {
			this.amplitude ??= 20;
			this.freq ??= 0.11;
			this.octaves ??= 3;
			this.warp ??= 0.2;
		} else if (p === "mountains") {
			this.amplitude ??= 15;
			this.freq ??= 0.10;
			this.octaves ??= 4;
			this.warp ??= 0.28;
		} else {
			// mixed
			this.amplitude ??= 6;
			this.freq ??= 0.105;
			this.octaves ??= 4;
			this.warp ??= 0.25;
		}
	}

	_sinCos(x, z, freq, phaseX, phaseZ) {
		return (
			Math.sin((x + phaseX) * freq) * 0.55 +
			Math.cos((z + phaseZ) * freq * 0.93) * 0.55 +
			Math.sin((x + z + phaseX * 0.5) * freq * 0.50) * 0.40
		);
	}

	_height01(x, z) {
		const w = this.warp ?? 0;

		const wx =
			x +
			w * 6 * Math.sin((z + this.seed) * 0.08) +
			w * 4 * Math.cos((x - this.seed) * 0.06);
		const wz =
			z +
			w * 6 * Math.cos((x + this.seed) * 0.08) +
			w * 4 * Math.sin((z - this.seed) * 0.06);

		let sum = 0;
		let amp = 1;
		let freq = this.freq;
		let norm = 0;

		for (let i = 0; i < this.octaves; i++) {
			const v = this._sinCos(
				wx,
				wz,
				freq,
				this.seed * 0.001 * (i + 1),
				this.seed * 0.002 * (i + 1),
			);

			sum += v * amp;
			norm += amp;

			amp *= 0.5;
			freq *= 2.0;
		}

		const n = (sum / norm + 1) * 0.5;
		return Math.max(0, Math.min(1, n));
	}

	_randInt(min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	getTopY(x, z) {

		// =========================
		// BIOME MASK
		// =========================
		// map 20x20:
		// bên trái = plains
		// bên phải = mountains

		const blendStart = -2;
		const blendEnd = 2;

		let mountainFactor;

		if (x <= blendStart) {
			mountainFactor = 0;
		}
		else if (x >= blendEnd) {
			mountainFactor = 1;
		}
		else {
			// blend mềm
			mountainFactor =
				(x - blendStart) /
				(blendEnd - blendStart);
		}

		// =========================
		// PLAINS
		// =========================

		const plainsNoise =
			this._height01(
				x * 0.8,
				z * 0.8
			);

		const plainsHeight =
			this.baseY +
			Math.round(plainsNoise * 2);

		// =========================
		// MOUNTAINS
		// =========================

		const mountainNoise =
			this._height01(
				x * 1.2,
				z * 1.2
			);

		const mountainHeight =
			this.baseY +
			Math.round(mountainNoise * 7);

		// =========================
		// BLEND
		// =========================

		let top =
			plainsHeight * (1 - mountainFactor) +
			mountainHeight * mountainFactor;

		top = Math.round(top);

		// =========================
		// CLAMP
		// =========================

		if (top < this.minTopY)
			top = this.minTopY;

		if (top > this.maxTopY)
			top = this.maxTopY;

		return top;
	}

	generate(world) {
		const half = Math.floor(this.mapSize / 2);

		const minX = -half;
		const maxX = -half + this.mapSize - 1;
		const minZ = -half;
		const maxZ = -half + this.mapSize - 1;

		const chunksX = Math.ceil(this.mapSize / this.chunkSize);
		const chunksZ = Math.ceil(this.mapSize / this.chunkSize);

		for (let cz = 0; cz < chunksZ; cz++) {
			for (let cx = 0; cx < chunksX; cx++) {
				this._generateChunk(world, cx, cz, minX, minZ, maxX, maxZ);
			}
		}
		this._generateVegetation(world, minX, maxX, minZ, maxZ);
		this._generateTrees(world, minX, maxX, minZ, maxZ);
		return { seed: this.seed, bounds: { minX, maxX, minZ, maxZ } };
	}

	_generateChunk(world, chunkX, chunkZ, minX, minZ, maxX, maxZ) {
		const startX = minX + chunkX * this.chunkSize;
		const startZ = minZ + chunkZ * this.chunkSize;
		const endX = Math.min(startX + this.chunkSize - 1, maxX);
		const endZ = Math.min(startZ + this.chunkSize - 1, maxZ);

		for (let x = startX; x <= endX; x++) {
			for (let z = startZ; z <= endZ; z++) {
				const topY = this.getTopY(x, z);

				// bedrock (đúng key của bạn)
				world.addBlock(x, this.bedrockY, z, BLOCK_TYPES.BED_ROCK);

				// Chỉ fill từ bedrock+1 lên topY => đúng ~10 block/cột
				for (let y = this.bedrockY + 1; y <= topY; y++) {
					const depth = topY - y;

					let t;
					if (depth === 0) t = BLOCK_TYPES.GRASS;
					else if (depth <= 3) t = BLOCK_TYPES.DIRT;
					else t = BLOCK_TYPES.STONE;

					world.addBlock(x, y, z, t);
				}
			}
		}
	}

	_generateVegetation(world, minX, maxX, minZ, maxZ) {
		// Random số lượng
		const berryCount = this._randInt(3, 7);
		const flowerCount = this._randInt(5, 9);

		// Spawn berry bush
		for (let i = 0; i < berryCount; i++) {
			const x = this._randInt(minX, maxX);
			const z = this._randInt(minZ, maxZ);

			const topY = this.getTopY(x, z);

			// Spawn trên grass
			world.addBlock(
				x,
				topY + 1,
				z,
				BLOCK_TYPES.BERRY_BUSH
			);
		}

		// Spawn flower
		for (let i = 0; i < flowerCount; i++) {
			const x = this._randInt(minX, maxX);
			const z = this._randInt(minZ, maxZ);

			const topY = this.getTopY(x, z);

			world.addBlock(
				x,
				topY + 1,
				z,
				BLOCK_TYPES.FLOWER_DANDELION
			);
		}
	}

	_generateTrees(world, minX, maxX, minZ, maxZ) {

		const treeCount = 2;

		const treePositions = [];

		for (let i = 0; i < treeCount; i++) {

			let tries = 0;
			let x, z;

			// =========================
			// TRÁNH SPAWN SÁT NHAU
			// =========================

			while (tries < 60) {

				x = this._randInt(minX + 5, maxX - 5);
				z = this._randInt(minZ + 5, maxZ - 5);

				let tooClose = false;

				for (const p of treePositions) {

					const dx = p.x - x;
					const dz = p.z - z;

					const dist = Math.sqrt(dx * dx + dz * dz);

					if (dist < 20) {
						tooClose = true;
						break;
					}
				}

				if (!tooClose) break;

				tries++;
			}

			treePositions.push({ x, z });

			const groundY = this.getTopY(x, z);

			// =========================
			// RANDOM TRUNK HEIGHT
			// =========================

			const trunkHeight = this._randInt(5, 6);

			// =========================
			// TRUNK
			// =========================

			for (let y = 1; y <= trunkHeight; y++) {

				world.addBlock(
					x,
					groundY + y,
					z,
					BLOCK_TYPES.WOOD
				);
			}

			// =========================
			// LEAF CANOPY
			// =========================

			const topY = groundY + trunkHeight;

			const radius = 2;

			for (let lx = -radius; lx <= radius; lx++) {
				for (let ly = -radius; ly <= radius; ly++) {
					for (let lz = -radius; lz <= radius; lz++) {

						const dist =
							Math.sqrt(
								lx * lx +
								ly * ly +
								lz * lz
							);

						// sphere-ish
						if (dist <= radius + Math.random() * 0.7) {

							// random holes/noise
							if (Math.random() < 0.18) continue;

							const leafX = x + lx;
							const leafY = topY + ly;
							const leafZ = z + lz;

							// tránh overwrite trunk
							const isTrunk =
								leafX === x &&
								leafZ === z &&
								leafY <= topY;

							if (!isTrunk) {

								world.addBlock(
									leafX,
									leafY,
									leafZ,
									BLOCK_TYPES.LEAVE
								);
							}
						}
					}
				}
			}

			// =========================
			// EXTRA LEAVES ON TOP
			// =========================

			for (let i = 0; i < 4; i++) {

				world.addBlock(
					x + this._randInt(-1, 1),
					topY + radius + this._randInt(0, 1),
					z + this._randInt(-1, 1),
					BLOCK_TYPES.LEAVE
				);
			}
		}
	}
}