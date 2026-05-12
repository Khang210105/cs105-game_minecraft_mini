// main.js
import * as THREE from "three";
import { BlockEngine } from "./BlockEngine.js";
import { World } from "./World.js";
import { Player } from "./Player.js";
import { Interaction } from "./Interaction.js";
import { Inventory } from "./Inventory.js";
import { BLOCK_TYPES } from "./blocks.js";

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

/* BẬT ĐỔ BÓNG */
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// --- Khởi tạo ---
const blockEngine = new BlockEngine(scene);
const world = new World(blockEngine);
world.generate(25);

const player = new Player(camera, document.body, world);
world.player = player // TÍNH NĂNG 1: THÊM DÒNG NÀY ĐỂ MÂY VÀ MẶT TRỜI BÁM THEO BẠN
const inventory = new Inventory();
const interaction = new Interaction(player, world, scene, inventory);

// --- Xử lý sự kiện Phím và Chuột ---
const instructions = document.getElementById("instructions");
const newGameButton = document.getElementById("new-game-btn");
const continueGameButton = document.getElementById("continue-game-btn");
let state = console.log(performance.getEntriesByType("navigation")[0].type);
// Click để khóa chuột vào game (trừ khi đang mở túi đồ)
continueGameButton.addEventListener("click", (e) => {
    player.controls.lock();
});

player.controls.addEventListener("lock", () => {
    instructions.style.display = "none";
});

player.controls.addEventListener("unlock", () => {
    if (!inventory.isOpen) {
        if (state === "going") {
            continueGameButton.style.display = "block";
            document.getElementById("save-game-btn").style.display = "block";
        }
        instructions.style.display = "block";
    }
});

document.addEventListener("keydown", (e) => {
    if (e.code === "KeyB") {
        if (inventory.isOpen) {
            inventory.toggleMenu();
            player.controls.lock();
        } else if (player.controls.isLocked) {
            player.controls.unlock();
            inventory.toggleMenu();
        }
    }
});

// --- Đồng hồ hệ thống vật lý ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    player.update(delta);
    interaction.update();
    if (blockEngine.updateFluids) blockEngine.updateFluids(delta); // TÍNH NĂNG 2: GỌI HÀM NÀY ĐỂ TEXTURE NƯỚC/LAVA TRÔI LIÊN TỤC
	world.tickFluids(delta); // Nước lan ra từ tâm đặt
    world.update(delta); // Hạt vỡ, lava nổ lùm bùm, mây trôi
    world.updateDayNightCycle(delta, scene, camera); // <-- Gọi cập nhật ngày đêm ở World.js
    renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function showLoadingIndicator() {
    document.getElementById("loading-overlay").style.display = "flex";
}

function hideLoadingIndicator() {
    document.getElementById("loading-overlay").style.display = "none";
}

// --- Hàm Reset Game ---
function resetGame() {
    world.blocks.forEach(block => scene.remove(block));
    world.blocks = [];
    world.blockMap.clear();

    world.particles.forEach(particle => {
        scene.remove(particle);
    });
    world.particles = [];

    player.position.set(0, 1, 0);
    player.velocity.set(0, 0, 0);
    player.canJump = false;
    player.keys = { w: false, a: false, s: false, d: false };

    camera.position.copy(player.position);
    camera.position.y += player.eyeLevel;
    camera.rotation.order = "YXZ";
    camera.rotation.y = 0;
    camera.rotation.x = 0;
    camera.rotation.z = 0;

    inventory.slots.fill(null);
    inventory.initDefaultItems();
    inventory.activeSlotIndex = 0;
    inventory.isOpen = false;
    inventory.renderHotbar();
    inventory.renderInventoryMenu();

    world.generate(25);
}

// --- SIMPLIFIED SAVE/LOAD GAME FUNCTIONS ---

// Step 1: Save game to JSON file
function saveGame(saveName) {
    if (!saveName.trim()) {
        alert("Please enter a save name");
        return;
    }

    try {
        const saveData = {
            version: 1,
            name: saveName,
            timestamp: new Date().toISOString(),
            // Lưu tọa độ người chơi (dùng player.camera.position cho an toàn)
            playerPosition: {
                x: player.camera.position.x,
                y: player.camera.position.y,
                z: player.camera.position.z,
            },
            cameraYaw: camera.rotation.y,
            cameraPitch: camera.rotation.x,
            
            // Quét mảng blocks 1 lần duy nhất và lấy ĐẦY ĐỦ dữ liệu
            blocks: world.blocks.map((block) => {
                const blockData = {
                    x: Math.round(block.position.x),
                    y: Math.round(block.position.y),
                    z: Math.round(block.position.z),
                    id: block.userData.type.id,
                };

                // NẾU LÀ CHẤT LỎNG, LƯU THÊM TRẠNG THÁI
                if (block.userData.type.isFluid) {
                    blockData.flowLevel = block.userData.flowLevel || 0;
                    blockData.isSource = block.userData.isSource || false;
                    blockData.scaleY = block.scale.y; 
                }
                
                return blockData;
            }).filter(Boolean) // Loại bỏ các block lỗi (nếu có)
        };

        const jsonString = JSON.stringify(saveData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${saveName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert(`Game saved as '${saveName}.json'`);
    } catch (error) {
        console.error("Save error:", error);
        alert("Error saving game: " + error.message);
    }
}

// Step 2: Load game from JSON file
function loadGame(fileContent) {
    try {
        const saveData = JSON.parse(fileContent);

        // Validate save data
        if (!saveData.blocks || !Array.isArray(saveData.blocks)) {
            throw new Error("Invalid save file format");
        }

        document.getElementById("load-file-status").textContent = "Loading...";
        if (typeof showLoadingIndicator === "function") showLoadingIndicator();

        setTimeout(() => {
            try {
                // Reset the game first
                resetGame();

                // Remove the freshly generated blocks
                world.blocks.forEach((block) => scene.remove(block));
                world.blocks = [];
                world.blockMap.clear();
                
                // MỚI: Dọn dẹp luôn các mảng chất lỏng để tránh lỗi bóng ma
                world.activeFluids = [];
                world.animatingFluids = [];
                world.activeLavaBlocks = [];

                // Restore saved blocks
                saveData.blocks.forEach((blockData) => {
                    const blockType = Object.values(BLOCK_TYPES).find(
                        (type) => type.id === blockData.id,
                    );

                    if (blockType) {
                        // SỬA QUAN TRỌNG: Gọi world.addBlock để game tự động thiết lập 
                        // bóng đổ và truyền thông số flowLevel, isSource cho chất lỏng
                        const block = world.addBlock(
                            blockData.x,
                            blockData.y,
                            blockData.z,
                            blockType,
                            blockData.flowLevel, // Sẽ là undefined với block thường (ko sao cả)
                            blockData.isSource
                        );

                        // Nếu là nước/lava, điều chỉnh lại độ cao mặt nước như lúc lưu
                        if (blockType.isFluid && block) {
                            block.scale.y = blockData.scaleY || 1.0;
                            block.position.y = blockData.y - (1 - block.scale.y) / 2;
                            
                            // Xóa block này khỏi danh sách đang "dâng lên" vì nó đã ở đúng vị trí
                            const animIndex = world.animatingFluids.indexOf(block);
                            if (animIndex > -1) world.animatingFluids.splice(animIndex, 1);
                        }
                    }
                });

                // Restore player position (Hỗ trợ đọc cả 2 cách lưu saveData của bạn)
                const px = saveData.playerPosition ? saveData.playerPosition.x : saveData.playerX;
                const py = saveData.playerPosition ? saveData.playerPosition.y : saveData.playerY;
                const pz = saveData.playerPosition ? saveData.playerPosition.z : saveData.playerZ;

                if (px !== undefined && py !== undefined && pz !== undefined) {
                    player.position.set(px, py, pz);
                    camera.position.copy(player.position);
                    // Đảm bảo player.eyeLevel tồn tại, nếu không mặc định là 1.6
                    camera.position.y += (player.eyeLevel !== undefined ? player.eyeLevel : 1.6);
                }

                // Restore camera view (yaw and pitch)
                if (saveData.cameraYaw !== undefined) {
                    camera.rotation.order = "YXZ";
                    camera.rotation.y = saveData.cameraYaw;
                    camera.rotation.x = saveData.cameraPitch || 0;
                    camera.rotation.z = 0;
                }

                // Reset player movement state to prevent drifting
                player.velocity.set(0, 0, 0);
                player.keys = { w: false, a: false, s: false, d: false };
                player.canJump = false;

                // Lock controls and finish
                if (typeof state !== 'undefined') state = "going";
                player.controls.lock();
                
                if (typeof hideLoadingIndicator === "function") hideLoadingIndicator();
                document.getElementById("load-dialog").style.display = "none";
                const instructions = document.getElementById("instructions");
                if (instructions) instructions.style.display = "none";
                
                document.getElementById("load-file-status").textContent = "Game loaded!";
            } catch (error) {
                console.error("Load error:", error);
                if (typeof hideLoadingIndicator === "function") hideLoadingIndicator();
                alert("Error loading game: " + error.message);
                document.getElementById("load-file-status").textContent = "Error: " + error.message;
            }
        }, 500);
    } catch (error) {
        console.error("Parse error:", error);
        alert("Error parsing save file: " + error.message);
        document.getElementById("load-file-status").textContent = "Error: " + error.message;
    }
}

// Step 3: Handle file selection
function setupFileLoadListener() {
	const fileInput = document.getElementById("load-file-input");
	fileInput.addEventListener("change", (e) => {
		const file = e.target.files[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			try {
				const content = event.target.result;
				loadGame(content);
			} catch (error) {
				console.error("FileReader error:", error);
				alert("Error reading file: " + error.message);
			}
		};
		reader.onerror = () => {
			alert("Error reading file");
		};
		reader.readAsText(file);
	});
}

// Initialize file listener
setupFileLoadListener();

// Save game button
document.getElementById("save-game-btn").addEventListener("click", () => {
	document.getElementById("save-dialog").style.display = "block";
	document.getElementById("save-name-input").value = "";
	document.getElementById("save-name-input").focus();
});

// Enter key support for save name input
document.getElementById("save-name-input").addEventListener("keypress", (e) => {
	if (e.key === "Enter") {
		const saveName = document.getElementById("save-name-input").value;
		saveGame(saveName);
		document.getElementById("save-dialog").style.display = "none";
	}
});

// Save confirm button
document.getElementById("save-confirm-btn").addEventListener("click", () => {
	const saveName = document.getElementById("save-name-input").value;
	saveGame(saveName);
	document.getElementById("save-dialog").style.display = "none";
});

// Save cancel button
document.getElementById("save-cancel-btn").addEventListener("click", () => {
	document.getElementById("save-dialog").style.display = "none";
});

// Load game button
document.getElementById("load-game-btn").addEventListener("click", () => {
	document.getElementById("load-dialog").style.display = "block";
	document.getElementById("load-file-status").textContent =
		"Select a .json save file";
	document.getElementById("load-file-input").value = "";
});

// Load file button - trigger file input
document.getElementById("load-file-btn").addEventListener("click", () => {
	document.getElementById("load-file-input").click();
});

// Load cancel button
document.getElementById("load-cancel-btn").addEventListener("click", () => {
	document.getElementById("load-dialog").style.display = "none";
});

// Gắn nút "New Game" với hàm reset
newGameButton.addEventListener("click", () => {
	showLoadingIndicator();
	setTimeout(() => {
		resetGame();
		state = "going";
		player.controls.lock();
		hideLoadingIndicator();
	}, 1000);
});