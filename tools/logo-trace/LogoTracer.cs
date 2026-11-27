using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;

public struct IPt
{
    public int X, Y;
    public IPt(int x, int y) { X = x; Y = y; }
}

public class Loop
{
    public List<IPt> Points = new List<IPt>();
    public int MinX, MaxX, MinY, MaxY;

    public void ComputeBBox()
    {
        MinX = int.MaxValue; MinY = int.MaxValue; MaxX = int.MinValue; MaxY = int.MinValue;
        foreach (var p in Points)
        {
            if (p.X < MinX) MinX = p.X;
            if (p.X > MaxX) MaxX = p.X;
            if (p.Y < MinY) MinY = p.Y;
            if (p.Y > MaxY) MaxY = p.Y;
        }
    }
}

public static class LogoTracer
{
    static double ColorDist(byte r, byte g, byte b, Color c)
    {
        double dr = r - c.R, dg = g - c.G, db = b - c.B;
        return dr * dr + dg * dg + db * db;
    }

    // Clasifica toda la imagen en 0=fondo, 1=navy, 2=teal
    static byte[,] Classify(Bitmap img, Color navy, Color teal, Color white)
    {
        int W = img.Width, H = img.Height;
        var cls = new byte[W, H];
        var rect = new Rectangle(0, 0, W, H);
        var bmpData = img.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
        int stride = bmpData.Stride;
        byte[] buf = new byte[stride * H];
        Marshal.Copy(bmpData.Scan0, buf, 0, buf.Length);
        img.UnlockBits(bmpData);

        for (int y = 0; y < H; y++)
        {
            for (int x = 0; x < W; x++)
            {
                int off = y * stride + x * 3;
                byte b = buf[off], g = buf[off + 1], r = buf[off + 2];
                double dN = ColorDist(r, g, b, navy);
                double dT = ColorDist(r, g, b, teal);
                double dW = ColorDist(r, g, b, white);
                if (dW <= dN && dW <= dT) cls[x, y] = 0;
                else if (dN < dT) cls[x, y] = 1;
                else cls[x, y] = 2;
            }
        }
        return cls;
    }

    // Traza los contornos (bordes entre pixel-de-la-clase y no-de-la-clase) dentro de un recorte.
    // Devuelve loops en coordenadas LOCALES al recorte (0..cropW, 0..cropH).
    public static List<Loop> TraceClass(byte[,] cls, int fx, int fy, int cw, int ch, byte target)
    {
        Func<int, int, bool> filled = (x, y) =>
        {
            int gx = fx + x, gy = fy + y;
            if (gx < 0 || gy < 0 || gx >= cls.GetLength(0) || gy >= cls.GetLength(1)) return false;
            return cls[gx, gy] == target;
        };

        // adjacency de vértices de la grilla (esquinas de píxeles) conectados por bordes de frontera
        var adj = new Dictionary<long, List<long>>();
        Func<int, int, long> key = (x, y) => ((long)(x + 100000) << 32) | (uint)(y + 100000);

        Action<int, int, int, int> addEdge = (x1, y1, x2, y2) =>
        {
            long k1 = key(x1, y1), k2 = key(x2, y2);
            if (!adj.ContainsKey(k1)) adj[k1] = new List<long>();
            if (!adj.ContainsKey(k2)) adj[k2] = new List<long>();
            adj[k1].Add(k2);
            adj[k2].Add(k1);
        };

        for (int y = 0; y < ch; y++)
        {
            for (int x = 0; x < cw; x++)
            {
                bool f = filled(x, y);
                // borde superior (entre (x,y-1) y (x,y))
                if (f != filled(x, y - 1)) addEdge(x, y, x + 1, y);
                // borde inferior
                if (f != filled(x, y + 1)) addEdge(x, y + 1, x + 1, y + 1);
                // borde izquierdo
                if (f != filled(x - 1, y)) addEdge(x, y, x, y + 1);
                // borde derecho
                if (f != filled(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1);
            }
        }

        var visitedEdge = new HashSet<long>();
        Func<long, long, long> edgeKey = (a, b) => a < b ? (a * 1000003L + b) : (b * 1000003L + a);

        var loops = new List<Loop>();
        foreach (var startKey in adj.Keys.ToList())
        {
            var neighbors = adj[startKey];
            for (int ni = 0; ni < neighbors.Count; ni++)
            {
                long firstEk = edgeKey(startKey, neighbors[ni]);
                if (visitedEdge.Contains(firstEk)) continue;

                // caminar el loop
                var loopKeys = new List<long>();
                long current = startKey;
                long prev = -1;
                bool ok = true;
                int guard = 0;
                while (true)
                {
                    guard++;
                    if (guard > 2000000) { ok = false; break; }
                    loopKeys.Add(current);
                    var opts = adj[current];
                    long next = -1;
                    foreach (var cand in opts)
                    {
                        long ek = edgeKey(current, cand);
                        if (visitedEdge.Contains(ek)) continue;
                        if (cand == prev && opts.Count(o => o == prev) <= 1) continue;
                        next = cand;
                        break;
                    }
                    if (next == -1)
                    {
                        // probar cualquier arista no visitada aunque vuelva atrás
                        foreach (var cand in opts)
                        {
                            long ek = edgeKey(current, cand);
                            if (!visitedEdge.Contains(ek)) { next = cand; break; }
                        }
                    }
                    if (next == -1) { ok = false; break; }
                    visitedEdge.Add(edgeKey(current, next));
                    prev = current;
                    current = next;
                    if (current == startKey) break;
                }

                if (!ok || loopKeys.Count < 4) continue;

                var loop = new Loop();
                foreach (var k in loopKeys)
                {
                    int lx = (int)(k >> 32) - 100000;
                    int ly = (int)(k & 0xFFFFFFFFL) - 100000;
                    loop.Points.Add(new IPt(lx, ly));
                }
                loop.ComputeBBox();
                if ((loop.MaxX - loop.MinX) < 1 || (loop.MaxY - loop.MinY) < 1) continue;
                if (Math.Abs(ShoelaceArea(loop.Points)) < 10) continue; // descarta ruido de compresion JPEG
                loops.Add(loop);
            }
        }
        return loops;
    }

    static double ShoelaceArea(List<IPt> pts)
    {
        double area = 0;
        int n = pts.Count;
        for (int i = 0; i < n; i++)
        {
            var a = pts[i]; var b = pts[(i + 1) % n];
            area += (double)a.X * b.Y - (double)b.X * a.Y;
        }
        return area / 2.0;
    }

    // Colapsa puntos colineales (conserva solo las esquinas reales)
    static List<IPt> CollapseCollinear(List<IPt> pts)
    {
        int n = pts.Count;
        var out_ = new List<IPt>();
        for (int i = 0; i < n; i++)
        {
            var prev = pts[(i - 1 + n) % n];
            var cur = pts[i];
            var next = pts[(i + 1) % n];
            int dx1 = cur.X - prev.X, dy1 = cur.Y - prev.Y;
            int dx2 = next.X - cur.X, dy2 = next.Y - cur.Y;
            if (dx1 * dy2 - dy1 * dx2 != 0) out_.Add(cur);
        }
        return out_.Count >= 3 ? out_ : pts;
    }

    static double PerpDist(IPt p, IPt a, IPt b)
    {
        double dx = b.X - a.X, dy = b.Y - a.Y;
        double len = Math.Sqrt(dx * dx + dy * dy);
        if (len < 1e-9) return Math.Sqrt(Math.Pow(p.X - a.X, 2) + Math.Pow(p.Y - a.Y, 2));
        double t = ((p.X - a.X) * dx + (p.Y - a.Y) * dy) / (len * len);
        double px = a.X + t * dx, py = a.Y + t * dy;
        return Math.Sqrt(Math.Pow(p.X - px, 2) + Math.Pow(p.Y - py, 2));
    }

    static List<IPt> DouglasPeucker(List<IPt> pts, double epsilon)
    {
        if (pts.Count < 3) return pts;
        double maxDist = 0; int idx = 0;
        for (int i = 1; i < pts.Count - 1; i++)
        {
            double d = PerpDist(pts[i], pts[0], pts[pts.Count - 1]);
            if (d > maxDist) { maxDist = d; idx = i; }
        }
        if (maxDist > epsilon)
        {
            var left = DouglasPeucker(pts.GetRange(0, idx + 1), epsilon);
            var right = DouglasPeucker(pts.GetRange(idx, pts.Count - idx), epsilon);
            var result = new List<IPt>(left);
            result.RemoveAt(result.Count - 1);
            result.AddRange(right);
            return result;
        }
        return new List<IPt> { pts[0], pts[pts.Count - 1] };
    }

    // Simplifica un loop cerrado con Douglas-Peucker (rompiendo en el punto mas lejano del centroide)
    static List<IPt> SimplifyClosed(List<IPt> pts, double epsilon)
    {
        if (pts.Count < 6) return pts;
        // parte el loop en dos mitades usando dos puntos separados ~180 grados por indice
        int mid = pts.Count / 2;
        var a = pts.GetRange(0, mid + 1);
        var b = pts.GetRange(mid, pts.Count - mid);
        b.Add(pts[0]);
        var sa = DouglasPeucker(a, epsilon);
        var sb = DouglasPeucker(b, epsilon);
        var result = new List<IPt>(sa);
        sb.RemoveAt(0);
        if (sb.Count > 0) sb.RemoveAt(sb.Count - 1);
        result.AddRange(sb);
        return result;
    }

    // Suavizado de Chaikin (corner-cutting) - loop cerrado
    static List<double[]> Chaikin(List<IPt> pts, int iterations)
    {
        List<double[]> cur = pts.Select(p => new double[] { p.X, p.Y }).ToList();
        for (int it = 0; it < iterations; it++)
        {
            var next = new List<double[]>();
            int n = cur.Count;
            for (int i = 0; i < n; i++)
            {
                var p0 = cur[i];
                var p1 = cur[(i + 1) % n];
                double qx = p0[0] * 0.75 + p1[0] * 0.25;
                double qy = p0[1] * 0.75 + p1[1] * 0.25;
                double rx = p0[0] * 0.25 + p1[0] * 0.75;
                double ry = p0[1] * 0.25 + p1[1] * 0.75;
                next.Add(new double[] { qx, qy });
                next.Add(new double[] { rx, ry });
            }
            cur = next;
        }
        return cur;
    }

    static string PathFromLoops(List<Loop> loops, double simplifyEps, int smoothIter)
    {
        var sb = new StringBuilder();
        foreach (var loop in loops)
        {
            var collapsed = CollapseCollinear(loop.Points);
            var simplified = SimplifyClosed(collapsed, simplifyEps);
            if (simplified.Count < 3) simplified = collapsed;
            var smooth = Chaikin(simplified, smoothIter);
            if (smooth.Count < 3) continue;

            sb.Append("M");
            sb.Append(Fmt(smooth[0][0])).Append(",").Append(Fmt(smooth[0][1])).Append(" ");
            sb.Append("L ");
            for (int i = 1; i < smooth.Count; i++)
            {
                sb.Append(Fmt(smooth[i][0])).Append(",").Append(Fmt(smooth[i][1])).Append(" ");
            }
            sb.Append("Z ");
        }
        return sb.ToString().Trim();
    }

    static string Fmt(double v)
    {
        return v.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture);
    }

    public class Group
    {
        public int MinX, MaxX;
        public List<Loop> Loops = new List<Loop>();
    }

    // Agrupa loops en "shapes" conectadas por proximidad en X (para separar palabra vs icono)
    static List<Group> GroupByXProximity(List<Loop> all, int gapThreshold)
    {
        var sorted = all.OrderBy(l => l.MinX).ToList();
        var groups = new List<Group>();
        foreach (var loop in sorted)
        {
            bool placed = false;
            for (int i = 0; i < groups.Count; i++)
            {
                var grp = groups[i];
                if (loop.MinX <= grp.MaxX + gapThreshold)
                {
                    grp.Loops.Add(loop);
                    grp.MaxX = Math.Max(grp.MaxX, loop.MaxX);
                    grp.MinX = Math.Min(grp.MinX, loop.MinX);
                    placed = true;
                    break;
                }
            }
            if (!placed)
            {
                var g = new Group();
                g.MinX = loop.MinX; g.MaxX = loop.MaxX;
                g.Loops.Add(loop);
                groups.Add(g);
            }
        }
        return groups;
    }

    public static void Run(string jpegPath, string outDir)
    {
        var img = new Bitmap(jpegPath);
        var navy = Color.FromArgb(8, 72, 120);
        var teal = Color.FromArgb(24, 168, 160);
        var white = Color.FromArgb(255, 255, 255);

        var cls = Classify(img, navy, teal, white);
        int W = img.Width, H = img.Height;

        int minX = W, maxX = 0, minY = H, maxY = 0;
        for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++)
                if (cls[x, y] != 0)
                {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }

        int pad = 4;
        int fx = Math.Max(0, minX - pad), fy = Math.Max(0, minY - pad);
        int fw = Math.Min(W - fx, maxX - minX + pad * 2), fh = Math.Min(H - fy, maxY - minY + pad * 2);

        var navyLoops = TraceClass(cls, fx, fy, fw, fh, 1);
        var tealLoops = TraceClass(cls, fx, fy, fw, fh, 2);

        double eps = 1.4;
        int smooth = 2;

        string navyPathFull = PathFromLoops(navyLoops, eps, smooth);
        string tealPathFull = PathFromLoops(tealLoops, eps, smooth);

        WriteSvg(Path.Combine(outDir, "logo-convive.svg"), fw, fh,
            new[] { new SvgPart(navyPathFull, "#084878"), new SvgPart(tealPathFull, "#18A8A0") });
        WriteSvg(Path.Combine(outDir, "logo-convive-white.svg"), fw, fh,
            new[] { new SvgPart(navyPathFull, "#ffffff"), new SvgPart(tealPathFull, "#ffffff") });

        // --- icono solo: agrupar todos los loops (ambos colores) por proximidad en X ---
        var allLoops = new List<Loop>();
        allLoops.AddRange(navyLoops);
        allLoops.AddRange(tealLoops);
        var groups = GroupByXProximity(allLoops, 1);
        var iconGroup = groups.OrderByDescending(g => g.MinX).First();

        int iMinX = int.MaxValue, iMaxX = int.MinValue, iMinY = int.MaxValue, iMaxY = int.MinValue;
        foreach (var l in iconGroup.Loops)
        {
            if (l.MinX < iMinX) iMinX = l.MinX;
            if (l.MaxX > iMaxX) iMaxX = l.MaxX;
            if (l.MinY < iMinY) iMinY = l.MinY;
            if (l.MaxY > iMaxY) iMaxY = l.MaxY;
        }
        int iPad = 4;
        int ox = iMinX - iPad, oy = iMinY - iPad;
        int ow = (iMaxX - iMinX) + iPad * 2, oh = (iMaxY - iMinY) + iPad * 2;

        var iconNavy = iconGroup.Loops.Where(l => navyLoops.Contains(l)).ToList();
        var iconTeal = iconGroup.Loops.Where(l => tealLoops.Contains(l)).ToList();

        string iconNavyPath = PathFromLoopsOffset(iconNavy, eps, smooth, ox, oy);
        string iconTealPath = PathFromLoopsOffset(iconTeal, eps, smooth, ox, oy);

        WriteSvg(Path.Combine(outDir, "logo-icon.svg"), ow, oh,
            new[] { new SvgPart(iconTealPath, "#18A8A0"), new SvgPart(iconNavyPath, "#084878") });

        File.WriteAllText(Path.Combine(outDir, "trace-info.txt"),
            "full crop: " + fw + "x" + fh + "\n" +
            "icon crop: " + ow + "x" + oh + " at (" + ox + "," + oy + ")\n" +
            "navy loops: " + navyLoops.Count + ", teal loops: " + tealLoops.Count + "\n" +
            "groups found: " + groups.Count + "\n");
    }

    static string PathFromLoopsOffset(List<Loop> loops, double simplifyEps, int smoothIter, int offX, int offY)
    {
        var shifted = new List<Loop>();
        foreach (var l in loops)
        {
            var nl = new Loop();
            foreach (var p in l.Points) nl.Points.Add(new IPt(p.X - offX, p.Y - offY));
            nl.ComputeBBox();
            shifted.Add(nl);
        }
        return PathFromLoops(shifted, simplifyEps, smoothIter);
    }

    static void WriteSvg(string path, int w, int h, SvgPart[] parts)
    {
        var sb = new StringBuilder();
        // width/height explícitos son necesarios: sin ellos, un <img> apuntando a este SVG
        // no tiene aspect-ratio intrinseco confiable y "width:auto" en CSS puede colapsar a 0
        // en varios navegadores.
        sb.Append("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 " + w + " " + h + "\" width=\"" + w + "\" height=\"" + h + "\">\n");
        foreach (var part in parts)
        {
            if (string.IsNullOrWhiteSpace(part.D)) continue;
            sb.Append("  <path fill-rule=\"evenodd\" fill=\"" + part.Fill + "\" d=\"" + part.D + "\"/>\n");
        }
        sb.Append("</svg>\n");
        File.WriteAllText(path, sb.ToString());
    }
}

public class SvgPart
{
    public string D, Fill;
    public SvgPart(string d, string fill) { D = d; Fill = fill; }
}
