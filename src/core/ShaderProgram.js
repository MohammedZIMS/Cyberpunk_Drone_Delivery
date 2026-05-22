

/**
 * Compile a single shader of the given type.
 * @param {WebGLRenderingContext} gl
 * @param {number} type   gl.VERTEX_SHADER | gl.FRAGMENT_SHADER
 * @param {string} source GLSL source string
 * @returns {WebGLShader}
 */
function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const typeName = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
    console.error(`[ShaderProgram] ${typeName} compile error:\n`,
      gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

/**
 * Build a complete shader program from source strings.
 * @param {WebGLRenderingContext} gl
 * @param {string} vertSrc  GLSL vertex shader source
 * @param {string} fragSrc  GLSL fragment shader source
 * @returns {WebGLProgram | null}
 */
export function createShaderProgram(gl, vertSrc, fragSrc) {
  const vert = compileShader(gl, gl.VERTEX_SHADER,   vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vert || !frag) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);

  // Shaders are baked into the program; we no longer need the individual objects
  gl.deleteShader(vert);
  gl.deleteShader(frag);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[ShaderProgram] Link error:\n', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

// ── Uniform upload helpers ─────────────────────────────────────────────────
// These avoid the boilerplate of gl.getUniformLocation every call.

export function setUniform1f(gl, prog, name, v)       { gl.uniform1f(gl.getUniformLocation(prog, name), v); }
export function setUniform1i(gl, prog, name, v)       { gl.uniform1i(gl.getUniformLocation(prog, name), v); }
export function setUniform3f(gl, prog, name, x, y, z) { gl.uniform3f(gl.getUniformLocation(prog, name), x, y, z); }
export function setUniform3fv(gl, prog, name, arr)    { gl.uniform3fv(gl.getUniformLocation(prog, name), arr); }
export function setUniform1fv(gl, prog, name, arr)    { gl.uniform1fv(gl.getUniformLocation(prog, name), arr); }
export function setUniformMat4(gl, prog, name, mat)   { gl.uniformMatrix4fv(gl.getUniformLocation(prog, name), false, mat); }