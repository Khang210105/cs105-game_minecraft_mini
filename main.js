// main.js
import * as THREE from 'three';
import { BlockEngine } from './BlockEngine.js';
import { World } from './World.js';
import { Player } from './Player.js';
import { Interaction } from './Interaction.js';
import { Inventory } from './Inventory.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

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
const instructions = document.getElementById('instructions');
// Click để khóa chuột vào game (trừ khi đang mở túi đồ)
document.body.addEventListener('click', (e) => {
    // Bỏ qua nếu click vào vùng của kho đồ
    if (e.target.closest('#inventory-menu') || inventory.isOpen) return;
    player.controls.lock();
});

player.controls.addEventListener('lock', () => {
    instructions.style.display = 'none';
});

player.controls.addEventListener('unlock', () => {
    // Chỉ hiện menu hướng dẫn nếu kho đồ đang KHÔNG mở
    if (!inventory.isOpen) {
        instructions.style.display = 'block';
    }
});

// Sự kiện bấm phím B
document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyB') {
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

function animate() {
    requestAnimationFrame(animate);
    
    // Lấy thời gian trôi qua giữa 2 khung hình để tính vật lý
    const delta = clock.getDelta();
    player.update(delta); 
    interaction.update();
    // THÊM DÒNG NÀY: Để tính toán rơi cho mảnh vụn
    world.update(delta);

    // THÊM DÒNG NÀY: Để làm nước và lava chảy
    blockEngine.updateFluids(delta);

    // THÊM DÒNG NÀY: Nước chảy lan ra xung quanh
    world.tickFluids(delta);

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});