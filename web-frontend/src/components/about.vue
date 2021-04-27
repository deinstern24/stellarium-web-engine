// Stellarium Web - Copyright (c) 2018 - Noctua Software Ltd
//
// This program is licensed under the terms of the GNU AGPL v3, or
// alternatively under a commercial licence.
//
// The terms of the AGPL v3 license can be found in the main directory of this
// repository.

<template>
<v-dialog scrollable max-width='600' v-model="$store.state.showAbout">
  <v-card v-if="$store.state.showAbout">
    <v-card-title><div class="headline">About</div></v-card-title>
    <v-card-text style="height: 600px;">
      <p>Welcome to the Starregister of DeinStern24.de. This software is an online planetarium, giving customers of DeinStern24.de the possibility to access their "Sterntaufe" by entering their registration number. It is based on "Stellarium Web", an online planetarium running in your web browser based on the open source <a href="https://github.com/Stellarium/stellarium-web-engine" target="_blank" rel="noopener">Stellarium Web Engine</a> project. Please ask questions or report bugs on <a href="https://deinstern24.de" target="_blank" rel="noopener">deinstern24.de</a>.
      <br>The source code for the version of Stellarium-Web used on this website (starregister.deinstern24.de), including any changes made to it, can be found on our <a href="https://github.com/deinstern24/stellarium-web-engine" target="_blank" rel="noopener">github page</a>. Our github page also includes instructions for setting the software up by yourself.
      <br>If you like this software and want to support the creators, please consider <a href="https://opencollective.com/stellarium/donate"  target="_blank" rel="noopener">donating to the stellarium project</a>.
      </p>
    </v-card-text>
    <v-card-actions>
      <v-spacer></v-spacer><v-btn text class="blue--text darken-1" @click.native="$store.state.showAbout = false">Close</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>
</template>

<script>
</script>

<style>
.data-credits {
  padding-left: 30px;
}
a {
  color: #82b1ff;
}
</style>
