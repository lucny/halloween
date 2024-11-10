AFRAME.registerComponent('oculus-thumbstick-controls', {
    schema: {
        acceleration: { default: 45 },
        rigSelector: {default: "#rig"},
        fly: { default: false },
        controllerOriented: { default: false },
        adAxis: {default: 'x', oneOf: ['x', 'y', 'z']},
        wsAxis: {default: 'z', oneOf: ['x', 'y', 'z']},
        enabled: {default: true},
        adEnabled: {default: true},
        adInverted: {default: false},
        wsEnabled: {default: true},
        wsInverted: {default: false}
    },
    init: function () {
        this.easing = 1.1;
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.tsData = new THREE.Vector2(0, 0);

        this.thumbstickMoved = this.thumbstickMoved.bind(this);
        this.el.addEventListener('thumbstickmoved', this.thumbstickMoved);
    },
    update: function() {
        this.rigElement = document.querySelector(this.data.rigSelector);
    },
    tick: function (time, delta) {
        if (!this.el.sceneEl.is('vr-mode')) return;
        var data = this.data;
        var el = this.rigElement;
        var velocity = this.velocity;

        if (!velocity[data.adAxis] && !velocity[data.wsAxis] && !this.tsData.length()) { return; }

        delta = delta / 1000;
        this.updateVelocity(delta);

        if (!velocity[data.adAxis] && !velocity[data.wsAxis]) { return; }

        el.object3D.position.add(this.getMovementVector(delta));
    },
    updateVelocity: function (delta) {
        var acceleration;
        var adAxis;
        var adSign;
        var data = this.data;
        var velocity = this.velocity;
        var wsAxis;
        var wsSign;
        const CLAMP_VELOCITY = 0.00001;

        adAxis = data.adAxis;
        wsAxis = data.wsAxis;

        if (delta > 0.2) {
            velocity[adAxis] = 0;
            velocity[wsAxis] = 0;
            return;
        }

        var scaledEasing = Math.pow(1 / this.easing, delta * 60);
        if (velocity[adAxis] !== 0) {
            velocity[adAxis] = velocity[adAxis] * scaledEasing;
        }
        if (velocity[wsAxis] !== 0) {
            velocity[wsAxis] = velocity[wsAxis] * scaledEasing;
        }

        if (Math.abs(velocity[adAxis]) < CLAMP_VELOCITY) { velocity[adAxis] = 0; }
        if (Math.abs(velocity[wsAxis]) < CLAMP_VELOCITY) { velocity[wsAxis] = 0; }

        if (!data.enabled) { return; }

        acceleration = data.acceleration;
        if (data.adEnabled && this.tsData.x) {
            adSign = data.adInverted ? -1 : 1;
            velocity[adAxis] += adSign * acceleration * this.tsData.x * delta; 
        }
        if (data.wsEnabled) {
            wsSign = data.wsInverted ? -1 : 1;
            velocity[wsAxis] += wsSign * acceleration * this.tsData.y * delta;
        }
    },
    getMovementVector: (function () {
        var directionVector = new THREE.Vector3(0, 0, 0);
        var rotationEuler = new THREE.Euler(0, 0, 0, 'YXZ');

        return function (delta) {
            var rotation = this.el.sceneEl.camera.el.object3D.rotation;
            var velocity = this.velocity;
            var xRotation;

            directionVector.copy(velocity);
            directionVector.multiplyScalar(delta);
            if (!rotation) { return directionVector; }
            xRotation = this.data.fly ? rotation.x : 0;

            rotationEuler.set(xRotation, rotation.y, 0);
            directionVector.applyEuler(rotationEuler);
            return directionVector;
        };
    })(),
    thumbstickMoved: function (evt) {
        this.tsData.set(evt.detail.x, evt.detail.y);
    },
    remove: function () {
        this.el.removeEventListener('thumbstickmoved', this.thumbstickMoved);
    }
});

AFRAME.registerComponent('manipulate-object', {
    init: function () {
        this.selectedObject = null;
        this.isDragging = false;
        this.originalPosition = new THREE.Vector3();
        this.originalParent = null;
        
        // Nastavení raycaster line
        this.el.setAttribute('line', {
            color: '#FF0000',
            opacity: 0.75,
            visible: true
        });

        // Sledování průsečíků
        this.el.addEventListener('raycaster-intersection', (evt) => {
            if (!this.isDragging) {
                const intersectedEl = evt.detail.els[0];
                if (intersectedEl && intersectedEl.classList.contains('draggable')) {
                    this.el.setAttribute('line', 'color', '#00FF00');
                }
            }
        });

        this.el.addEventListener('raycaster-intersection-cleared', () => {
            if (!this.isDragging) {
                this.el.setAttribute('line', 'color', '#FF0000');
            }
        });

        // Uchopení objektu
        this.el.addEventListener('triggerdown', () => {
            const raycaster = this.el.components.raycaster;
            const intersections = raycaster.intersectedEls;
            
            if (intersections.length > 0) {
                const intersectedEl = intersections[0];
                if (intersectedEl.classList.contains('draggable')) {
                    this.selectedObject = intersectedEl;
                    this.isDragging = true;
                    
                    // Uložení původní pozice a rodiče
                    this.originalPosition.copy(this.selectedObject.object3D.position);
                    this.originalParent = this.selectedObject.object3D.parent;
                    
                    // Připojení objektu k ovladači
                    const worldPosition = new THREE.Vector3();
                    this.selectedObject.object3D.getWorldPosition(worldPosition);
                    this.el.object3D.worldToLocal(worldPosition);
                    this.selectedObject.object3D.position.copy(worldPosition);
                    this.el.object3D.add(this.selectedObject.object3D);
                    
                    // Vizuální zpětná vazba
                    this.el.setAttribute('line', 'color', '#0000FF');
                }
            }
        });

        // Puštění objektu
        this.el.addEventListener('triggerup', () => {
            if (this.isDragging && this.selectedObject) {
                // Vrácení objektu do původní hierarchie
                const worldPosition = new THREE.Vector3();
                this.selectedObject.object3D.getWorldPosition(worldPosition);
                this.originalParent.worldToLocal(worldPosition);
                this.selectedObject.object3D.position.copy(worldPosition);
                this.originalParent.add(this.selectedObject.object3D);
                
                this.isDragging = false;
                this.selectedObject = null;
                this.el.setAttribute('line', 'color', '#FF0000');
            }
        });
    }
});