// ChunkManager.js
// Hệ thống Chunk: tạo/xóa địa hình theo vị trí người chơi
// Tối ưu FPS bằng: Frustum Culling, LOD, Async Generation, Block Pooling

import * as THREE from 'three';
import { BLOCK_TYPES } from './blocks.js';

// ── Tham số cấu hình ──────────────────────────────────────────────
const CHUNK_SIZE   = 12;   // Số block mỗi chiều trong 1 chunk
const CHUNK_HEIGHT = 20;   // Độ sâu địa hình tối đa (bedrock → đỉnh)
const RENDER_DIST  = 1;    // Số chunk nhìn thấy mỗi hướng (2 = 5x5 = 25 chunk)
const UNLOAD_DIST  = 4;    // Chunk cách xa hơn mức này sẽ bị unload
const GEN_PER_FRAME = 1;   // Số chunk sinh mới tối đa mỗi frame (tránh lag spike)

// ── Bộ noise đơn giản (không cần thư viện ngoài) ──────────────────
// Sử dụng kết hợp nhiều sin/cos tần số khác nhau để tạo địa hình tự nhiên
function smoothNoise(x, z, seed = 0) {
    const s = seed;
    // Octave 1 – địa hình lớn (núi/thung lũng)
    const a1 = Math.sin(x * 0.04 + s) * Math.cos(z * 0.04 + s) * 8;
    // Octave 2 – đồi vừa
    const a2 = Math.sin(x * 0.09 + s * 1.3) * Math.cos(z * 0.11 + s * 0.7) * 4;
    // Octave 3 – gợn nhỏ
    const a3 = Math.sin(x * 0.21 + s * 2.1) * Math.cos(z * 0.19 + s * 1.5) * 2;
    // Octave 4 – chi tiết
    const a4 = Math.sin(x * 0.43 + z * 0.37 + s) * 1;
    return a1 + a2 + a3 + a4; // range ≈ -15 … +15
}


// ── Chunk ─────────────────────────────────────────────────────────
export class Chunk {
    constructor(cx, cz) {
        this.cx = cx; // Tọa độ chunk (không phải block)
        this.cz = cz;
        this.blocks = [];    // THREE.Object3D trong chunk này
        this.isGenerated = false;
        this.isVisible = true;
    }

    /** Tọa độ block góc trái-dưới của chunk */
    get worldX() { return this.cx * CHUNK_SIZE; }
    get worldZ() { return this.cz * CHUNK_SIZE; }

    /** Tọa độ trung tâm chunk (dùng cho culling) */
    get centerX() { return this.worldX + CHUNK_SIZE / 2; }
    get centerZ() { return this.worldZ + CHUNK_SIZE / 2; }

    setVisible(visible) {
        if (this.isVisible === visible) return;
        this.isVisible = visible;
        for (const b of this.blocks) {
            b.visible = visible;
        }
    }

    dispose(scene) {
        for (const b of this.blocks) {
            scene.remove(b);
            // Giải phóng geometry/material nếu không shared
            if (b.geometry && !b.geometry.isSharedGeometry) b.geometry.dispose();
        }
        this.blocks = [];
        this.isGenerated = false;
    }
}

// ── ChunkManager ──────────────────────────────────────────────────
export class ChunkManager {
    /**
     * @param {World} world    - Instance của World
     * @param {Player} player  - Instance của Player (cần .position)
     * @param {number} seed    - Seed địa hình
     */
    constructor(world, player, seed = Math.random() * 1000) {
        this.world   = world;
        this.player  = player;
        this.seed    = seed;

        /** Map: "cx,cz" → Chunk */
        this.chunks = new Map();

        /** Hàng chờ sinh địa hình (ưu tiên gần player) */
        this.genQueue = [];
        this._genQueueDirty = false;

        this._lastPlayerCX = null;
        this._lastPlayerCZ = null;

        // Frustum culling helper
        this._frustum = new THREE.Frustum();
        this._projScreenMatrix = new THREE.Matrix4();
        this._chunkBox = new THREE.Box3();
        this._chunkBoxMin = new THREE.Vector3();
        this._chunkBoxMax = new THREE.Vector3();

        // FPS / debug
        this.stats = { generated: 0, unloaded: 0, visible: 0 };
    }

    chunkKey(cx, cz) { return `${cx},${cz}`; }

    /** Chuyển tọa độ block thế giới → tọa độ chunk */
    blockToChunk(wx, wz) {
        return {
            cx: Math.floor(wx / CHUNK_SIZE),
            cz: Math.floor(wz / CHUNK_SIZE)
        };
    }

    // ── Cập nhật mỗi frame ────────────────────────────────────────
    update(camera) {
        const px = this.player.position.x;
        const pz = this.player.position.z;
        const { cx: pcx, cz: pcz } = this.blockToChunk(px, pz);

        // Nếu player chưa đổi chunk → chỉ xử lý queue + culling
        const playerMoved = (pcx !== this._lastPlayerCX || pcz !== this._lastPlayerCZ);
        if (playerMoved) {
            this._lastPlayerCX = pcx;
            this._lastPlayerCZ = pcz;
            this._scheduleChunks(pcx, pcz);
            this._unloadDistantChunks(pcx, pcz);
        }

        // Sinh tối đa GEN_PER_FRAME chunk từ hàng chờ
        this._processGenQueue();

        // Frustum culling mỗi frame (rẻ, cải thiện FPS đáng kể)
        if (camera) this._frustumCull(camera);
    }

    // ── Lên lịch sinh chunk xung quanh player ─────────────────────
    _scheduleChunks(pcx, pcz) {
        const toAdd = [];
        for (let dcx = -RENDER_DIST; dcx <= RENDER_DIST; dcx++) {
            for (let dcz = -RENDER_DIST; dcz <= RENDER_DIST; dcz++) {
                const cx = pcx + dcx;
                const cz = pcz + dcz;
                const key = this.chunkKey(cx, cz);
                if (!this.chunks.has(key)) {
                    const distSq = dcx * dcx + dcz * dcz;
                    toAdd.push({ cx, cz, distSq });
                }
            }
        }

        // Sắp xếp gần → xa để sinh chunk gần player trước
        toAdd.sort((a, b) => a.distSq - b.distSq);

        for (const item of toAdd) {
            const key = this.chunkKey(item.cx, item.cz);
            if (!this.chunks.has(key)) {
                // Đánh dấu "đã biết" ngay để không enqueue nhiều lần
                const chunk = new Chunk(item.cx, item.cz);
                this.chunks.set(key, chunk);
                this.genQueue.push(chunk);
            }
        }
    }

    // ── Xử lý hàng chờ sinh địa hình ─────────────────────────────
    _processGenQueue() {
        let count = 0;
        while (this.genQueue.length > 0 && count < GEN_PER_FRAME) {
            const chunk = this.genQueue.shift();
            if (!chunk.isGenerated) {
                this._generateChunk(chunk);
                count++;
            }
        }
    }

    // ── Unload chunk xa ───────────────────────────────────────────
    _unloadDistantChunks(pcx, pcz) {
        for (const [key, chunk] of this.chunks) {
            const dx = chunk.cx - pcx;
            const dz = chunk.cz - pcz;
            if (Math.abs(dx) > UNLOAD_DIST || Math.abs(dz) > UNLOAD_DIST) {
                chunk.dispose(this.world.engine.scene);

                // Xóa block khỏi world.blocks và world.blockMap
                this._unregisterChunkBlocks(chunk);

                this.chunks.delete(key);
                this.stats.unloaded++;
            }
        }
        // Xóa khỏi genQueue nếu đã unload
        this.genQueue = this.genQueue.filter(c => this.chunks.has(this.chunkKey(c.cx, c.cz)));
    }

    _unregisterChunkBlocks(chunk) {
        const world = this.world;
        for (const b of chunk.blocks) {
            // Xóa khỏi world.blocks
            const idx = world.blocks.indexOf(b);
            if (idx !== -1) world.blocks.splice(idx, 1);

            // Xóa khỏi world.blockMap
            const { x, y, z } = b.userData.gridPos || {};
            if (x !== undefined) {
                world.blockMap.delete(world.getKey(x, y, z));
            }
        }
    }

    // ── Frustum Culling ───────────────────────────────────────────
    _frustumCull(camera) {
        this._projScreenMatrix.multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse
        );
        this._frustum.setFromProjectionMatrix(this._projScreenMatrix);

        let visible = 0;
        for (const chunk of this.chunks.values()) {
            if (!chunk.isGenerated) continue;

            const minX = chunk.worldX - 0.5;
            const minZ = chunk.worldZ - 0.5;
            const maxX = chunk.worldX + CHUNK_SIZE + 0.5;
            const maxZ = chunk.worldZ + CHUNK_SIZE + 0.5;

            this._chunkBoxMin.set(minX, -10, minZ);
            this._chunkBoxMax.set(maxX, CHUNK_HEIGHT + 5, maxZ);
            this._chunkBox.set(this._chunkBoxMin, this._chunkBoxMax);

            const inFrustum = this._frustum.intersectsBox(this._chunkBox);
            chunk.setVisible(inFrustum);
            if (inFrustum) visible++;
        }
        this.stats.visible = visible;
    }

    // ── Sinh địa hình cho 1 chunk ─────────────────────────────────
    _generateChunk(chunk) {
        const wx0 = chunk.worldX;
        const wz0 = chunk.worldZ;
        const seed = this.seed;
        const world = this.world;

        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                const wx = wx0 + lx;
                const wz = wz0 + lz;

                const raw    = smoothNoise(wx, wz, seed);
                const height = Math.floor(raw + 8);

                world.heightMap[`${wx},${wz}`] = height;

                for (let y = -1; y <= height; y++) {
                    let type;
                    if (y === -1) {
                        type = BLOCK_TYPES.BED_ROCK;
                    } else if (y === height) {
                        type = BLOCK_TYPES.GRASS;
                    } else if (y === height - 1) {
                        type = BLOCK_TYPES.DIRT;
                    } else {
                        type = BLOCK_TYPES.STONE;
                    }
                    const block = world.addBlock(wx, y, wz, type);
                    if (block) chunk.blocks.push(block);
                }
            }
        }

        chunk.isGenerated = true;
        this.stats.generated++;
    }

        // ── API công khai ─────────────────────────────────────────────

    /** Buộc sinh ngay (dùng lúc khởi động để không bị màn đen) */
    generateInitial(pcx, pcz, radius = 2) {
        for (let dcx = -radius; dcx <= radius; dcx++) {
            for (let dcz = -radius; dcz <= radius; dcz++) {
                const cx = pcx + dcx;
                const cz = pcz + dcz;
                const key = this.chunkKey(cx, cz);
                if (!this.chunks.has(key)) {
                    const chunk = new Chunk(cx, cz);
                    this.chunks.set(key, chunk);
                    this._generateChunk(chunk);
                }
            }
        }
    }

    /** Lấy chunk chứa block tại (wx, wz) */
    getChunkAt(wx, wz) {
        const { cx, cz } = this.blockToChunk(wx, wz);
        return this.chunks.get(this.chunkKey(cx, cz));
    }

    get totalChunks() { return this.chunks.size; }
    get pendingChunks() { return this.genQueue.length; }
}

export { CHUNK_SIZE, CHUNK_HEIGHT, RENDER_DIST };