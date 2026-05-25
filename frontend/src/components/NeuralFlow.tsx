import { useEffect, useRef } from 'react'

function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1
  const displayWidth = Math.floor(canvas.clientWidth * dpr)
  const displayHeight = Math.floor(canvas.clientHeight * dpr)
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth
    canvas.height = displayHeight
    return true
  }
  return false
}

const VERTEX_SHADER = `
  attribute vec3 a_pos;
  attribute vec3 a_color;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_speed;
  uniform float u_amplitude;
  uniform float u_density;
  uniform vec3 u_color;
  uniform vec3 u_secondaryColor;
  uniform vec2 u_mouse;
  varying vec3 v_color;
  varying float v_opacity;

  void main() {
    float d = distance(a_pos.xy, u_mouse);
    float mouseInfluence = smoothstep(0.5, 0.0, d) * 0.3;
    float influence = (sin(u_time * u_speed + a_pos.z) * 0.5 + 0.5) * u_amplitude + mouseInfluence;
    vec3 baseColor = a_color / 255.0;
    v_color = mix(baseColor, u_secondaryColor, influence);
    float pulse = sin(u_time * 2.0 + length(a_pos.xy) * 10.0) * 0.5 + 0.5;
    v_opacity = 0.6 + pulse * 0.4 + mouseInfluence;
    gl_Position = vec4(a_pos.xy, 0.0, 1.0);
    gl_PointSize = 2.5 + influence * 2.0;
  }
`

const FRAGMENT_SHADER = `
  precision mediump float;
  varying vec3 v_color;
  varying float v_opacity;

  void main() {
    gl_FragColor = vec4(v_color, v_opacity);
  }
`

const LINE_VERTEX_SHADER = `
  attribute vec3 a_pos;
  uniform vec2 u_resolution;
  uniform float u_time;

  void main() {
    gl_Position = vec4(a_pos, 1.0);
  }
`

const LINE_FRAGMENT_SHADER = `
  precision mediump float;
  void main() {
    gl_FragColor = vec4(0.529, 0.808, 0.922, 0.15);
  }
`

export default function NeuralFlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', { alpha: true, antialias: true })
    if (!gl) return

    const speed = 0.5
    const density = 1.0
    const amplitude = 1.0
    const baseColor = [34, 197, 94]
    const secondaryColor = [59, 130, 246]
    const mouse = [-1, -1]

    // Compile shader
    function compileShader(src: string, type: number) {
      const shader = gl!.createShader(type)!
      gl!.shaderSource(shader, src)
      gl!.compileShader(shader)
      return shader
    }

    // Point program
    const pointVert = compileShader(VERTEX_SHADER, gl.VERTEX_SHADER)
    const pointFrag = compileShader(FRAGMENT_SHADER, gl.FRAGMENT_SHADER)
    const pointProgram = gl.createProgram()!
    gl.attachShader(pointProgram, pointVert)
    gl.attachShader(pointProgram, pointFrag)
    gl.linkProgram(pointProgram)

    // Line program
    const lineVert = compileShader(LINE_VERTEX_SHADER, gl.VERTEX_SHADER)
    const lineFrag = compileShader(LINE_FRAGMENT_SHADER, gl.FRAGMENT_SHADER)
    const lineProgram = gl.createProgram()!
    gl.attachShader(lineProgram, lineVert)
    gl.attachShader(lineProgram, lineFrag)
    gl.linkProgram(lineProgram)

    const programs = { points: pointProgram, lines: lineProgram }

    // Create points
    function createPoints() {
      const rows = 30
      const cols = 40
      const spacingX = 2.5 / cols
      const spacingY = 2.0 / rows
      const points: number[][] = []
      const colors: number[] = []

      for (let i = 0; i <= rows; i++) {
        for (let j = 0; j <= cols; j++) {
          const x = -1.25 + j * spacingX + (Math.random() - 0.5) * 0.1
          const y = -1.0 + i * spacingY + (Math.random() - 0.5) * 0.1
          const phase = Math.random() * Math.PI * 2
          points.push([x, y, phase])
          colors.push(
            baseColor[0] + Math.random() * 20,
            baseColor[1] + Math.random() * 20,
            baseColor[2] + Math.random() * 40
          )
        }
      }
      return { points, colors }
    }

    // Find connections
    function findConnections(points: number[][]) {
      const threshold = 0.08
      const maxConnections = 3
      const connections: number[][] = []

      for (let i = 0; i < points.length; i++) {
        let count = 0
        for (let j = i + 1; j < points.length; j++) {
          if (count >= maxConnections) break
          const dx = points[i][0] - points[j][0]
          const dy = points[i][1] - points[j][1]
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < threshold) {
            connections.push(points[i], points[j])
            count++
          }
        }
      }
      return connections
    }

    // Init VBOs
    function initVBOs(
      glCtx: WebGLRenderingContext,
      points: number[][],
      colors: number[],
      connections: number[][]
    ) {
      const pBuf = glCtx.createBuffer()!
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, pBuf)
      glCtx.bufferData(glCtx.ARRAY_BUFFER, new Float32Array(points.flat()), glCtx.STATIC_DRAW)

      const cBuf = glCtx.createBuffer()!
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, cBuf)
      glCtx.bufferData(glCtx.ARRAY_BUFFER, new Float32Array(colors), glCtx.STATIC_DRAW)

      const lBuf = glCtx.createBuffer()!
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, lBuf)
      glCtx.bufferData(glCtx.ARRAY_BUFFER, new Float32Array(connections.flat()), glCtx.STATIC_DRAW)

      return { pBuf, cBuf, lBuf }
    }

    const { points, colors } = createPoints()
    const connections = findConnections(points)
    const buffers = initVBOs(gl, points, colors, connections)

    const pointCount = points.length
    const lineCount = connections.length / 2

    // Get attribute/uniform locations
    const aPosLoc = gl.getAttribLocation(programs.points, 'a_pos')
    const aColorLoc = gl.getAttribLocation(programs.points, 'a_color')
    const aLinePosLoc = gl.getAttribLocation(programs.lines, 'a_pos')

    const uTimeLoc = gl.getUniformLocation(programs.points, 'u_time')
    const uSpeedLoc = gl.getUniformLocation(programs.points, 'u_speed')
    const uAmpLoc = gl.getUniformLocation(programs.points, 'u_amplitude')
    const uDensityLoc = gl.getUniformLocation(programs.points, 'u_density')
    const uColorLoc = gl.getUniformLocation(programs.points, 'u_color')
    const uSecColorLoc = gl.getUniformLocation(programs.points, 'u_secondaryColor')
    const uResLoc = gl.getUniformLocation(programs.points, 'u_resolution')
    const uMouseLoc = gl.getUniformLocation(programs.points, 'u_mouse')

    const uLineResLoc = gl.getUniformLocation(programs.lines, 'u_resolution')
    const uLineTimeLoc = gl.getUniformLocation(programs.lines, 'u_time')

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    function render(now: number) {
      const time = now * 0.001
      const cvs = canvasRef.current
      if (!cvs || !gl) return
      resizeCanvasToDisplaySize(cvs)
      gl.viewport(0, 0, cvs.width, cvs.height)
      gl.clear(gl.DEPTH_BUFFER_BIT)

      // Render points
      gl!.useProgram(programs.points)
      gl!.bindBuffer(gl!.ARRAY_BUFFER, buffers.pBuf)
      gl!.enableVertexAttribArray(aPosLoc)
      gl!.vertexAttribPointer(aPosLoc, 3, gl!.FLOAT, false, 0, 0)

      gl!.bindBuffer(gl!.ARRAY_BUFFER, buffers.cBuf)
      gl!.enableVertexAttribArray(aColorLoc)
      gl!.vertexAttribPointer(aColorLoc, 3, gl!.FLOAT, false, 0, 0)

      gl!.uniform1f(uTimeLoc, time)
      gl!.uniform1f(uSpeedLoc, speed)
      gl!.uniform1f(uAmpLoc, amplitude)
      gl!.uniform1f(uDensityLoc, density)
      gl!.uniform3f(uColorLoc, baseColor[0] / 255, baseColor[1] / 255, baseColor[2] / 255)
      gl!.uniform3f(uSecColorLoc, secondaryColor[0] / 255, secondaryColor[1] / 255, secondaryColor[2] / 255)
      gl!.uniform2f(uResLoc, cvs.width, cvs.height)
      gl!.uniform2f(uMouseLoc, mouse[0], mouse[1])

      gl!.drawArrays(gl!.POINTS, 0, pointCount)

      // Render lines
      gl!.useProgram(programs.lines)
      gl!.bindBuffer(gl!.ARRAY_BUFFER, buffers.lBuf)
      gl!.enableVertexAttribArray(aLinePosLoc)
      gl!.vertexAttribPointer(aLinePosLoc, 3, gl!.FLOAT, false, 0, 0)
      gl!.uniform2f(uLineResLoc, cvs.width, cvs.height)
      gl!.uniform1f(uLineTimeLoc, time)
      gl!.drawArrays(gl!.LINES, 0, lineCount * 2)

      animRef.current = requestAnimationFrame(render)
    }

    animRef.current = requestAnimationFrame(render)

    // Event listeners
    const handleMouseMove = (e: MouseEvent) => {
      const cvs2 = canvasRef.current
      if (!cvs2) return
      const rect = cvs2.getBoundingClientRect()
      mouse[0] = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse[1] = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
    }

    const handleMouseLeave = () => {
      mouse[0] = -1
      mouse[1] = -1
    }

    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      cancelAnimationFrame(animRef.current)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'auto' }}
    />
  )
}
