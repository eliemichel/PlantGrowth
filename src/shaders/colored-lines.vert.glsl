precision highp float;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float scale;

attribute vec3 position;
attribute vec3 color;
attribute mat4 transform;

varying vec3 vColor;

void main() {
	vColor = color;
	gl_Position = projectionMatrix * modelViewMatrix * transform * vec4( position * scale, 1.0 );
}
