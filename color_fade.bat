# color_fade.bat - Executed by the repeating event
# CH6-10: Deltas, CH11: DelayMS, CH12: StepsRemaining
if $CH12>0 then "backlog AddChannel 1 $CH6; AddChannel 2 $CH7; AddChannel 3 $CH8; AddChannel 4 $CH9; AddChannel 5 $CH10; AddChannel 12 -1" else cancelRepeatingEvent 1