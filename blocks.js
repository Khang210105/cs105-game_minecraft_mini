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
    GLASS: { id: 4, name: 'Glass', color: 0xffffff, texture: './textures/blocks/glass.png', transparent: true, solid: true, opacity: 0.6 },
    IRON_ORE: { id: 5, name: 'Iron_ore', color: 0xffffff, texture: './textures/blocks/iron_ore.png', solid: true },
    IRON_BLOCK: { id: 6, name: 'Iron_block', color: 0xffffff, texture: './textures/blocks/iron_block.png', solid: true },
    SEA_GRASS: { id: 7, name: 'Sea_grass', texture: './textures/blocks/seagrass_carried.png', solid: false, isPlant: true, transparent: true },
    BED_ROCK: { id: 8, name: 'Bed_rock', color: 0xffffff, texture: './textures/blocks/bedrock.png', solid: true },

    WATER: { 
        id: 9, name: 'Water',
        texture: './textures/blocks/water_flow.png',
        transparent: true,
        opacity: 0.8,
        solid: false,
        isFluid: true,
        maxFlow: 5,
        flowTickSeconds: 0.55,
        hideInInventory: true
    },

    LAVA: { 
        id: 10, name: 'Lava',
        texture: './textures/blocks/lava_flow.png',
        emissive: 0xff5500,
        intensity: 1,
        transparent: false,
        opacity: 1.0,
        solid: false,
        isFluid: true,
        maxFlow: 3,
        flowTickSeconds: 1.15,
        hideInInventory: true
    },

    BUCKET_EMPTY: {
        id: 11, name: 'Empty Bucket',
        isItem: true,
        texture: './textures/blocks/empty_bucket.png',
        transparent: true, solid: false,
        isBucket: true, isEmpty: true
    },
    BUCKET_WATER: {
        id: 12, name: 'Water Bucket',
        isItem: true,
        texture: './textures/blocks/bucket_water.png',
        transparent: true, solid: false,
        isBucket: true, isEmpty: false,
        placesBlock: 'WATER'
    },
    BUCKET_LAVA: {
        id: 13, name: 'Lava Bucket',
        isItem: true,
        texture: './textures/blocks/bucket_lava.png',
        transparent: true, solid: false,
        isBucket: true, isEmpty: false,
        placesBlock: 'LAVA'
    },
    WOOD: {
        id: 14,
        name: "Wood",
        solid: true,
        textures: [
            "./textures/blocks/log_oak.png",
            "./textures/blocks/log_oak.png",
            "./textures/blocks/log_oak_top.png",
            "./textures/blocks/log_oak_top.png",
            "./textures/blocks/log_oak.png",
            "./textures/blocks/log_oak.png",
        ]
    },
    BEACON:  { id: 15, name: 'Beacon',  color: 0xffffff, texture: './textures/blocks/beacon.png',  solid: true },
    BLUE_ICE:  { id: 16, name: 'BlueIce',  color: 0xffffff, texture: './textures/blocks/blue_ice.png',  solid: true },
    BRICK:  { id: 17, name: 'Brick',  color: 0xffffff, texture: './textures/blocks/brick.png',  solid: true },
    CHEST: {
        id: 18,
        name: "Chest",
        solid: true,
        textures: [
            "./textures/blocks/chest_front.png",
            "./textures/blocks/chest_side.png",
            "./textures/blocks/chest_top.png",
            "./textures/blocks/chest_top.png",
            "./textures/blocks/chest_side.png",
            "./textures/blocks/chest_side.png",
        ]
    },
    CHISELED_TUFF: {
        id: 19,
        name: "Chiseled_tuff",
        solid: true,
        textures: [
            "./textures/blocks/chiseled_tuff.png",
            "./textures/blocks/chiseled_tuff.png",
            "./textures/blocks/chiseled_tuff_top.png",
            "./textures/blocks/chiseled_tuff_top.png",
            "./textures/blocks/chiseled_tuff.png",
            "./textures/blocks/chiseled_tuff.png",
        ]
    },
    CRAFTED_TABLE: {
        id: 20,
        name: "Crafted_table",
        solid: true,
        textures: [
            "./textures/blocks/crafting_table_front.png",
            "./textures/blocks/crafting_table_side.png",
            "./textures/blocks/crafting_table_top.png",
            "./textures/blocks/crafting_table_top.png",
            "./textures/blocks/crafting_table_side.png",
            "./textures/blocks/crafting_table_side.png",
        ]
    },
    DIAMOND_ORE: { id: 21, name: 'Diamond_ore', color: 0xffffff, texture: './textures/blocks/diamond_ore.png', solid: true },
    DIAMOND_BLOCK: { id: 22, name: 'Diamond_block', color: 0xffffff, texture: './textures/blocks/diamond_block.png', solid: true },
    FLOWER_DANDELION: { id: 23, name: 'Flower_dandelion', textures: ["./textures/blocks/flower_dandelion.png"], solid: false, isPlant: true, transparent: true },
    GRASS_SNOW: { 
        id: 24, 
        name: 'Grass_snow', 
        color: 0xffffff,
        textures: [
            './textures/blocks/grass_block_snow.png', // 1. Phải
            './textures/blocks/grass_block_snow.png', // 2. Trái
            './textures/blocks/snow.png',  // 3. Trên
            './textures/blocks/dirt.png',       // 4. Dưới
            './textures/blocks/grass_block_snow.png', // 5. Trước
            './textures/blocks/grass_block_snow.png'  // 6. Sau
        ],
        solid: true 
    },
    OAK_SAMPLING: { id: 25, name: 'Oak_sampling', textures: ["./textures/blocks/sapling_oak.png"], solid: false, isPlant: true, transparent: true },
    TNT: { 
        id: 26, 
        name: 'TNT', 
        color: 0xffffff,
        textures: [
            './textures/blocks/tnt_side.png', // 1. Phải
            './textures/blocks/tnt_side.png', // 2. Trái
            './textures/blocks/tnt_top.png',  // 3. Trên
            './textures/blocks/tnt_bottom.png',       // 4. Dưới
            './textures/blocks/tnt_side.png', // 5. Trước
            './textures/blocks/tnt_side.png'  // 6. Sau
        ],
        solid: true 
    },
    PUMPKIN: { 
        id: 27, 
        name: 'Pumpkin', 
        color: 0xffffff,
        textures: [
            './textures/blocks/pumpkin_side.png', // 1. Phải
            './textures/blocks/pumpkin_side.png', // 2. Trái
            './textures/blocks/pumpkin_top.png',  // 3. Trên
            './textures/blocks/pumpkin_side.png',       // 4. Dưới
            './textures/blocks/pumpkin_face_off.png', // 5. Trước
            './textures/blocks/pumpkin_side.png'  // 6. Sau
        ],
        solid: true 
    },
    BERRY_BUSH: { id: 28, name: 'Berry_bush', textures: ["./textures/blocks/sweet_berry_bush_stage3.png"], solid: false, isPlant: true, transparent: true },
    LEAVE: {
        id: 29,
        name: "Leave",
        solid: true,
        textures: [
            "./textures/blocks/azalea_leaves.png",
            "./textures/blocks/azalea_leaves.png",
            "./textures/blocks/azalea_leaves.png",
            "./textures/blocks/azalea_leaves.png",
            "./textures/blocks/azalea_leaves.png",
            "./textures/blocks/azalea_leaves.png",
        ],
        transparent: true,
        opacity: 0.6,
    },
    PLANK:  { id: 30, name: 'Plank',  color: 0xffffff, texture: './textures/blocks/planks_oak.png',  solid: true },
};