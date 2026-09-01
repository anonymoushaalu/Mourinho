import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Provides `scene.environment` so the model's clearcoat (eyes) and sheen
 * (outfit, eyelashes) materials have something to reflect -- without it they
 * render flat and plasticky, and the eyes lose their specular catchlight.
 *
 * Uses three's bundled `RoomEnvironment`, not drei's `<Environment preset>`,
 * which fetches an HDR from a CDN at runtime -- unacceptable for a portfolio
 * site (adds a network dependency and an offline blank-avatar failure mode).
 *
 * Renders nothing; this is a side-effect-only component.
 */
export function StudioEnvironment(): null {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = envMap;

    return () => {
      scene.environment = null;
      envMap.dispose();
    };
  }, [gl, scene]);

  return null;
}
