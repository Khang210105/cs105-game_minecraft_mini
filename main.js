// main.js
import * as THREE from "three";
import { BlockEngine } from "./BlockEngine.js";
import { World } from "./World.js";
import { Player } from "./Player.js";
import { Interaction } from "./Interaction.js";
import { Inventory } from "./Inventory.js";
import { BLOCK_TYPES } from "./blocks.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

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

/* ÁNH SÁNG MÔI TRƯỜNG */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

/* ÁNH SÁNG MẶT TRỜI */
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(12, 18, 8);
dirLight.castShadow = true;

/* CẤU HÌNH VÙNG BÓNG */
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 100;
dirLight.shadow.camera.left = -40;
dirLight.shadow.camera.right = 40;
dirLight.shadow.camera.top = 40;
dirLight.shadow.camera.bottom = -40;
dirLight.shadow.bias = -0.0005;
dirLight.target.position.set(0, 0, 0);
scene.add(dirLight);
scene.add(dirLight.target);

/* TẠO HÌNH MẶT TRỜI */
const sunGeometry = new THREE.SphereGeometry(1.8, 32, 32);
const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffdd66 });
const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
sunMesh.position.copy(dirLight.position);
scene.add(sunMesh);

// --- Khởi tạo ---
const blockEngine = new BlockEngine(scene);
const world = new World(blockEngine);
world.generate(25);

// Truyền world vào Player để tính va chạm
const player = new Player(camera, document.body, world);
// KHỞI TẠO TÚI ĐỒ VÀ TƯƠNG TÁC
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
	// Chỉ hiện menu hướng dẫn nếu kho đồ đang KHÔNG mở
	if (!inventory.isOpen) {
		if (state === "going") {
			continueGameButton.style.display = "block";
			document.getElementById("save-game-btn").style.display = "block";
		}
		instructions.style.display = "block";
	}
});

// Sự kiện bấm phím B
document.addEventListener("keydown", (e) => {
	if (e.code === "KeyB") {
		if (inventory.isOpen) {
			// Đóng kho đồ, tự động khóa chuột vào game lại
			inventory.toggleMenu();
			player.controls.lock();
		} else if (player.controls.isLocked) {
			// Mở kho đồ, giải phóng chuột để chọn block
			player.controls.unlock();
			inventory.toggleMenu();
		}
	}
});

// --- Đồng hồ hệ thống vật lý ---
const clock = new THREE.Clock();
/* BẬT/TẮT CHU KỲ NGÀY ĐÊM */
const enableDayNightCycle = true;
let sunAngle = Math.PI / 4;

/* HÀM CẬP NHẬT MẶT TRỜI */
function updateSun(delta) {
    if (!enableDayNightCycle) return;

    sunAngle += delta * 0.03; 

    const radius = 30;
    const x = radius * Math.cos(sunAngle);
    const y = 5 + radius * Math.sin(sunAngle);
    const z = 10;

    dirLight.position.set(x, y, z);
    sunMesh.position.copy(dirLight.position);

    const daylight = Math.max(0, y / radius);

    scene.background = new THREE.Color().lerpColors(
        new THREE.Color(0x0b1026),
        new THREE.Color(0x87ceeb),
        daylight
    );

    dirLight.intensity = 0.15 + daylight * 1.05;
    ambientLight.intensity = 0.15 + daylight * 0.3;
}

function animate() {
	requestAnimationFrame(animate);

	// Lấy thời gian trôi qua giữa 2 khung hình để tính vật lý
	const delta = clock.getDelta();
	player.update(delta);
	interaction.update();
	// THÊM DÒNG NÀY: Để tính toán rơi cho mảnh vụn
	world.update(delta);
	updateSun(delta);
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
	// 1. Xóa tất cả blocks khỏi scene
	world.blocks.forEach((block) => {
		scene.remove(block);
	});
	world.blocks = [];
	world.blockMap.clear();

	// 2. Xóa tất cả particles khỏi scene
	world.particles.forEach((particle) => {
		scene.remove(particle);
	});
	world.particles = [];

	// 3. Reset vị trí và vận tốc của nhân vật
	player.position.set(0, 1, 0);
	player.velocity.set(0, 0, 0);
	player.canJump = false;
	player.keys = { w: false, a: false, s: false, d: false };

	// 4. Reset camera position and rotation
	camera.position.copy(player.position);
	camera.position.y += player.eyeLevel;
	camera.rotation.order = "YXZ";
	camera.rotation.y = 0;
	camera.rotation.x = 0;
	camera.rotation.z = 0;

	// 5. Reset inventory
	inventory.slots.fill(null);
	inventory.initDefaultItems();
	inventory.activeSlotIndex = 0;
	inventory.isOpen = false;
	inventory.renderHotbar();
	inventory.renderInventoryMenu();

	// 6. Regenerate the world
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
		// Collect only the essential data: blocks and player position
		const blocksData = [];
		world.blocks.forEach((block) => {
			if (block.userData && block.userData.type && block.userData.type.id) {
				blocksData.push({
					x: Math.round(block.position.x),
					y: Math.round(block.position.y),
					z: Math.round(block.position.z),
					id: block.userData.type.id,
				});
			}
		});

		const saveData = {
			version: 1,
			timestamp: new Date().toISOString(),
			playerX: player.position.x,
			playerY: player.position.y,
			playerZ: player.position.z,
			cameraYaw: camera.rotation.y,
			cameraPitch: camera.rotation.x,
			blocks: blocksData,
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
		showLoadingIndicator();

		setTimeout(() => {
			try {
				// Reset the game first (clears everything and initializes properly)
				resetGame();

				// Remove the freshly generated blocks
				world.blocks.forEach((block) => scene.remove(block));
				world.blocks = [];
				world.blockMap.clear();

				// Restore saved blocks
				saveData.blocks.forEach((blockData) => {
					const blockType = Object.values(BLOCK_TYPES).find(
						(type) => type.id === blockData.id,
					);

					if (blockType) {
						const block = blockEngine.createBlock(
							blockData.x,
							blockData.y,
							blockData.z,
							blockType,
						);
						world.blocks.push(block);
						world.blockMap.set(
							world.getKey(blockData.x, blockData.y, blockData.z),
							block,
						);
					}
				});

				// Restore player position
				if (
					saveData.playerX !== undefined &&
					saveData.playerY !== undefined &&
					saveData.playerZ !== undefined
				) {
					player.position.set(
						saveData.playerX,
						saveData.playerY,
						saveData.playerZ,
					);
					camera.position.copy(player.position);
					camera.position.y += player.eyeLevel;
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
				state = "going";
				player.controls.lock();
				hideLoadingIndicator();
				document.getElementById("load-dialog").style.display = "none";
				document.getElementById("instructions").style.display = "none";
				document.getElementById("load-file-status").textContent =
					"Game loaded!";
			} catch (error) {
				console.error("Load error:", error);
				hideLoadingIndicator();
				alert("Error loading game: " + error.message);
				document.getElementById("load-file-status").textContent =
					"Error: " + error.message;
			}
		}, 500);
	} catch (error) {
		console.error("Parse error:", error);
		alert("Error parsing save file: " + error.message);
		document.getElementById("load-file-status").textContent =
			"Error: " + error.message;
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