<?php

namespace App\Controller;

use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Response;

class DefaultController extends Controller
{
    /**
     * @Route("/", name="default")
     */
    public function index(): Response
    {
        return $this->redirectToRoute('presentation');
    }

    /**
     * @Route("/presentation/{presentationName}", name="presentation")
     */
    public function presentation($presentationName = 'default'): Response
    {
        $slidesFile = "slides/$presentationName.html.twig";

        if (!$this->get('twig')->getLoader()->exists($slidesFile)) {
            throw $this->createNotFoundException('Presentation not found.');
        }

        return $this->render('default/index.html.twig', [
            'presentation_slides' => $slidesFile,
        ]);
    }
}
