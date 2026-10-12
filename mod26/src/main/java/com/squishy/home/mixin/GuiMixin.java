package com.squishy.home.mixin;

import com.squishy.home.SquishyHomeScreen;
import net.minecraft.client.gui.Gui;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

@Mixin(Gui.class)
public abstract class GuiMixin {
	@ModifyVariable(method = "setScreen", at = @At("HEAD"), argsOnly = true)
	private Screen squishy$swapTitle(Screen screen) {
		if (screen != null && screen.getClass() == TitleScreen.class) {
			return new SquishyHomeScreen();
		}
		return screen;
	}
}
