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
        this.grabbed = null;
        this.grabOffset = new THREE.Vector3();
        
        this.el.addEventListener('raycaster-intersected', () => {
            const intersection = this.el.components.raycaster.getIntersection(this.el);
            if (!intersection) return;
            intersection.object.el.setAttribute('material', 'color', 'red');
            intersection.object.el.object3D.position.y += 1;
        });

        this.el.addEventListener('triggerdown', () => {
            const intersection = this.el.components.raycaster.getIntersection(this.el);
            if (!intersection) return;
            
            const grabbedEl = intersection.object.el;
            while (grabbedEl && !grabbedEl.classList.contains('draggable')) {
                grabbedEl = grabbedEl.parentElement;
            }
            
            if (grabbedEl && grabbedEl.classList.contains('draggable')) {
                this.grabbed = grabbedEl;
                // Vypočítat offset mezi pozicí ovladače a objektu
                const worldPosition = new THREE.Vector3();
                this.grabbed.object3D.getWorldPosition(worldPosition);
                this.grabOffset.copy(worldPosition).sub(this.el.object3D.position);
            }
        });

        this.el.addEventListener('triggerup', () => {
            this.grabbed = null;
        });
    },

    tick: function() {
        if (!this.grabbed) return;

        // Aktualizovat pozici drženého objektu
        const controllerPosition = this.el.object3D.position;
        const targetPosition = new THREE.Vector3().copy(controllerPosition).add(this.grabOffset);
        this.grabbed.object3D.position.copy(targetPosition);
    }
});