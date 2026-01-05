function startAnimation( self, ani, now, isCore ){
  const ani_p = ani._private;

  ani_p.started = true;
  ani_p.startTime = now - ani_p.progress * ani_p.duration;
}

export default startAnimation;
