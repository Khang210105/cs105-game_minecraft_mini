// blocks.js
// Danh sách các loại block, có thể thêm mới block hoặc chỉnh sửa ở đây
export const BLOCK_TYPES = {
    GRASS: { 
        id: 1, 
        name: 'Grass', 
        color: 0xffffff,
        textures: [
            './textures/blocks/grass_side_carried.png', // 1. Phải
            './textures/blocks/grass_side_carried.png', // 2. Trái
            './textures/blocks/grass_carried.png',  // 3. Trên
            './textures/blocks/dirt.png',       // 4. Dưới
            './textures/blocks/grass_side_carried.png', // 5. Trước
            './textures/blocks/grass_side_carried.png'  // 6. Sau
        ],
        solid: true 
    },
    DIRT:  { id: 2, name: 'Dirt',  color: 0xffffff, texture: './textures/blocks/dirt.png',  solid: true },
    STONE: { id: 3, name: 'Stone', color: 0xffffff, texture: './textures/blocks/stone.png', solid: true },
    GLASS: { id: 4, name: 'Glass', color: 0xffffff, texture: './textures/blocks/glass.png', transparent: true, opacity: 0.6 },
    IRON_ORE: { id: 5, name: 'Iron_ore', color: 0xffffff, texture: './textures/blocks/iron_ore.png', solid: true },
    IRON_BLOCK: { id: 6, name: 'Iron_block', color: 0xffffff, texture: './textures/blocks/iron_block.png', solid: true },
    SEA_GRASS: { id: 7, name: 'Sea_grass', texture: './textures/blocks/seagrass_carried.png', solid: false, isPlant: true, transparent: true },
    BED_ROCK: { id: 8, name: 'Bed_rock', color: 0xffffff, texture: './textures/blocks/bedrock.png', solid: true },
};