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
        this.selectedObject = null;
        this.isDragging = false;

        this.thumbstickMoved = this.thumbstickMoved.bind(this)
        /* this.triggerUp = this.triggerUp.bind(this) */
        this.el.addEventListener('thumbstickmoved', this.thumbstickMoved);
        /* this.el.addEventListener('triggerup', this.triggerUp); */
    
        // Nastavení laserového výběru
        this.el.addEventListener('raycaster-intersected', (event) => {
          this.raycaster = event.detail.el;
        });
    
        this.el.addEventListener('raycaster-intersected-cleared', () => {
          this.raycaster = null;
        });
    
        // Vybrání objektu při stisku trigger
        this.el.addEventListener('triggerdown', () => {
          if (this.raycaster) {
            let intersectedEl = this.raycaster.components.raycaster.getIntersection(this.el);
            if (intersectedEl && intersectedEl.el.classList.contains('draggable')) {
              this.selectedObject = intersectedEl.el;
              this.isDragging = true;
            }
          }
        });
    
        // Zrušení výběru objektu při uvolnění triggeru
        this.el.addEventListener('triggerup', () => {
          this.isDragging = false;
          this.selectedObject = null;
        });        
    },
    update: function() {
        this.rigElement = document.querySelector(this.data.rigSelector)
    },
    tick: function (time, delta) {
        if (!this.el.sceneEl.is('vr-mode')) return;
        var data = this.data;
        var el = this.rigElement
        var velocity = this.velocity;
        //console.log("here", this.tsData, this.tsData.length())
        if (!velocity[data.adAxis] && !velocity[data.wsAxis] && !this.tsData.length()) { return; }

        // Update velocity.
        delta = delta / 1000;
        this.updateVelocity(delta);

        if (!velocity[data.adAxis] && !velocity[data.wsAxis]) { return; }

        // Get movement vector and translate position.
        el.object3D.position.add(this.getMovementVector(delta));
        // Přemístění objektu podle pozice ovladače
        if (this.isDragging && this.selectedObject) {
            let controllerPosition = this.el.object3D.position;
            this.selectedObject.object3D.position.copy(controllerPosition);
        }        
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

        // If FPS too low, reset velocity.
        if (delta > 0.2) {
            velocity[adAxis] = 0;
            velocity[wsAxis] = 0;
            return;
        }

        // https://gamedev.stackexchange.com/questions/151383/frame-rate-independant-movement-with-acceleration
        var scaledEasing = Math.pow(1 / this.easing, delta * 60);
        // Velocity Easing.
        if (velocity[adAxis] !== 0) {
            velocity[adAxis] = velocity[adAxis] * scaledEasing;
        }
        if (velocity[wsAxis] !== 0) {
            velocity[wsAxis] = velocity[wsAxis] * scaledEasing;
        }

        // Clamp velocity easing.
        if (Math.abs(velocity[adAxis]) < CLAMP_VELOCITY) { velocity[adAxis] = 0; }
        if (Math.abs(velocity[wsAxis]) < CLAMP_VELOCITY) { velocity[wsAxis] = 0; }

        if (!data.enabled) { return; }

        // Update velocity using keys pressed.
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
            var rotation = this.el.sceneEl.camera.el.object3D.rotation
            var velocity = this.velocity;
            var xRotation;

            directionVector.copy(velocity);
            directionVector.multiplyScalar(delta);
            // Absolute.
            if (!rotation) { return directionVector; }
            xRotation = this.data.fly ? rotation.x : 0;

            // Transform direction relative to heading.
            rotationEuler.set(xRotation, rotation.y, 0);
            directionVector.applyEuler(rotationEuler);
            return directionVector;
        };
    })(),
    thumbstickMoved: function (evt) {
        this.tsData.set(evt.detail.x, evt.detail.y);
    },
/*    triggerUp: function (evt) {
        this.tsData.set(0, 0);
        // změň barvu objektu pumpkin na červenou a jeho pozici v ose y o 1
        let pumpkin = document.querySelector("#pumpkin");
        pumpkin.setAttribute("material", "color", "red");
        pumpkin.object3D.position.y += 1;
    },*/
    remove: function () {
        this.el.removeEventListener('thumbstickmoved', this.thumbstickMoved);
    },
    
});

AFRAME.registerComponent('manipulate-object', {
    init: function () {
      this.selectedObject = null;
      this.isDragging = false;
  
      // Nastavení laserového výběru
      this.el.addEventListener('raycaster-intersected', (event) => {
        this.raycaster = event.detail.el;
      });
  
      this.el.addEventListener('raycaster-intersected-cleared', () => {
        this.raycaster = null;
      });
  
      // Vybrání objektu při stisku trigger
      this.el.addEventListener('triggerdown', () => {
        if (this.raycaster) {
          let intersectedEl = this.raycaster.components.raycaster.getIntersection(this.el);
          if (intersectedEl && intersectedEl.el.classList.contains('draggable')) {
            this.selectedObject = intersectedEl.el;
            this.isDragging = true;
          }
        }
      });
  
      // Zrušení výběru objektu při uvolnění triggeru
      this.el.addEventListener('triggerup', () => {
        this.isDragging = false;
        this.selectedObject = null;
      });
    },
  
    tick: function () {
      // Přemístění objektu podle pozice ovladače
      if (this.isDragging && this.selectedObject) {
        let controllerPosition = this.el.object3D.position;
        this.selectedObject.object3D.position.copy(controllerPosition);
      }
    }
  });
  