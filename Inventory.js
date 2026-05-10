// Inventory.js
import { BLOCK_TYPES } from './blocks.js';

export class Inventory {
    constructor() {
        this.slots = new Array(8).fill(null); // 8 ô trong hotbar
        this.activeSlotIndex = 0; // Đang chọn ô số 1 (index 0)
        this.isOpen = false;
        this.hoveredBlockType = null; // Block đang được chuột chỉ vào trong kho

        this.initDefaultItems();
        this.renderHotbar();
        this.renderInventoryMenu();
        this.initEvents();
    }

    initDefaultItems() {
        // Lọc ra các block KHÔNG bị ẩn (không có hideInInventory)
        const types = Object.values(BLOCK_TYPES).filter(t => !t.hideInInventory);
        
        for (let i = 0; i < Math.min(8, types.length); i++) {
            this.slots[i] = types[i];
        }
    }

    // --- HÀM TẠO ICON CHO TÚI ĐỒ ---
    createBlockIcon(blockType) {
        const icon = document.createElement('div');
        icon.className = 'block-icon';
        icon.style.imageRendering = 'pixelated'; // Giúp ảnh Minecraft sắc nét, không bị mờ

        // 1. Trường hợp block có 6 mặt (mảng textures) -> Lấy mặt đầu tiên (index 0) làm icon
        if (blockType.textures && blockType.textures.length > 0) {
            icon.style.backgroundImage = `url('${blockType.textures[0]}')`;
            icon.style.backgroundSize = 'cover';
        } 
        // 2. Trường hợp block có 1 ảnh chung (texture)
        else if (blockType.texture) {
            icon.style.backgroundImage = `url('${blockType.texture}')`;
            icon.style.backgroundSize = 'cover';
        } 
        // 3. Trường hợp block chỉ có màu trơn
        else if (blockType.color !== undefined) {
            icon.style.backgroundColor = '#' + blockType.color.toString(16).padStart(6, '0');
        } 
        // 4. Mặc định nếu không có gì
        else {
            icon.style.backgroundColor = '#cccccc'; // Màu xám mặc định
        }

        return icon;
    }

    // --- RENDER GIAO DIỆN ---
    renderHotbar() {
        const hotbarUI = document.getElementById('hotbar');
        hotbarUI.innerHTML = ''; // Xóa cũ

        for (let i = 0; i < 8; i++) {
            const slotDiv = document.createElement('div');
            slotDiv.className = `hotbar-slot ${i === this.activeSlotIndex ? 'active' : ''}`;
            
            const numberSpan = document.createElement('span');
            numberSpan.className = 'slot-number';
            numberSpan.innerText = i + 1;
            slotDiv.appendChild(numberSpan);

            // SỬA Ở ĐÂY: Dùng hàm tạo icon mới
            const blockType = this.slots[i];
            if (blockType) {
                const icon = this.createBlockIcon(blockType);
                slotDiv.appendChild(icon);
            }

            hotbarUI.appendChild(slotDiv);
        }
    }

    renderInventoryMenu() {
        const gridUI = document.getElementById('inventory-grid');
        gridUI.innerHTML = '';

        Object.values(BLOCK_TYPES).filter(t => !t.hideInInventory).forEach(type => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'inv-item';
            
            // SỬA Ở ĐÂY: Dùng hàm tạo icon mới
            const icon = this.createBlockIcon(type);
            itemDiv.appendChild(icon);

            itemDiv.addEventListener('mouseenter', () => this.hoveredBlockType = type);
            itemDiv.addEventListener('mouseleave', () => this.hoveredBlockType = null);

            gridUI.appendChild(itemDiv);
        });
    }

    // --- LOGIC XỬ LÝ ---
    toggleMenu() {
        this.isOpen = !this.isOpen;
        document.getElementById('inventory-menu').style.display = this.isOpen ? 'block' : 'none';
        
        // Ẩn tâm ngắm khi mở túi đồ
        document.getElementById('crosshair').style.display = this.isOpen ? 'none' : 'block';
    }

    handleNumberInput(num) {
        const index = num - 1; // Vì phím 1 tương ứng với index 0
        
        if (this.isOpen) {
            // ĐANG MỞ KHO: Nếu chuột đang chỉ vào block nào, gán nó vào phím vừa bấm
            if (this.hoveredBlockType) {
                this.slots[index] = this.hoveredBlockType;
                this.renderHotbar();
            }
        } else {
            // ĐANG ĐÓNG KHO: Đổi slot đang cầm trên tay
            this.activeSlotIndex = index;
            this.renderHotbar();
        }
    }

    getCurrentBlock() {
        return this.slots[this.activeSlotIndex];
    }

    initEvents() {
        document.addEventListener('keydown', (e) => {
            // Xử lý phím từ 1 đến 8
            if (e.key >= '1' && e.key <= '8') {
                this.handleNumberInput(parseInt(e.key));
            }
        });

        // --- XỬ LÝ LĂN CHUỘT ---
        window.addEventListener('wheel', (e) => {
            // Nếu đang mở Menu túi đồ to (ấn phím B) thì không cho lăn chuột ở hotbar
            if (this.isOpen) return; 
            
            if (e.deltaY > 0) {
                // Lăn chuột xuống -> Tiến tới ô tiếp theo bên phải
                this.activeSlotIndex++;
                // Nếu vượt quá ô cuối cùng thì vòng lại ô đầu tiên
                if (this.activeSlotIndex >= this.slots.length) {
                    this.activeSlotIndex = 0;
                }
            } else {
                // Lăn chuột lên -> Lùi về ô trước đó bên trái
                this.activeSlotIndex--;
                // Nếu lùi quá ô đầu tiên thì vòng về ô cuối cùng
                if (this.activeSlotIndex < 0) {
                    this.activeSlotIndex = this.slots.length - 1;
                }
            }

            // Gọi hàm cập nhật lại giao diện hotbar
            this.renderHotbar(); 
        });
    }
}